"""CyberShield Backend — Scan endpoints (frontend-facing, §4)."""

from __future__ import annotations

import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import MAX_UPLOAD_SIZE_BYTES, UPLOAD_DIR
from app.database import get_db
from app.models import Finding, Job, LogEntry, Scan, ScanStatus, TERMINAL_STATUSES
from app.schemas import (
    FindingsResponse,
    FindingSchema,
    LogEntrySchema,
    LogsResponse,
    ReportResponse,
    ScanCreate,
    ScanDetail,
    ScanStartRequest,
    ScanStatusResponse,
    ScanSummary,
)

router = APIRouter(prefix="/api/scans", tags=["scans"])

# APK magic bytes: ZIP local file header (PK\x03\x04)
_APK_MAGIC = b"PK\x03\x04"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# POST /api/scans — create scan record
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_scan(
    body: ScanCreate | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    scan = Scan()
    if body and body.apk_filename:
        scan.apk_filename = body.apk_filename
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    return {"scan_id": scan.id}


# ---------------------------------------------------------------------------
# POST /api/scans/{scan_id}/upload — multipart APK upload
# ---------------------------------------------------------------------------

@router.post("/{scan_id}/upload")
async def upload_apk(
    scan_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    if scan.status != ScanStatus.created.value:
        raise HTTPException(status.HTTP_409_CONFLICT, "APK already uploaded for this scan")

    # Read file into memory (up to limit) — for a hackathon this is fine
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB limit",
        )

    # Validate magic bytes (ZIP/APK)
    if not contents[:4] == _APK_MAGIC:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "File does not appear to be a valid APK (bad magic bytes)",
        )

    # Compute SHA-256
    sha256 = hashlib.sha256(contents).hexdigest()

    # Save to disk
    scan_dir = UPLOAD_DIR / scan_id
    scan_dir.mkdir(parents=True, exist_ok=True)
    apk_path = scan_dir / "input.apk"
    apk_path.write_bytes(contents)

    # Update scan record
    scan.apk_filename = file.filename or "unknown.apk"
    scan.apk_size_bytes = len(contents)
    scan.sha256 = sha256
    scan.status = ScanStatus.uploaded.value

    # Add log entry
    db.add(LogEntry(scan_id=scan_id, stage="upload", message=f"APK uploaded: {scan.apk_filename} ({len(contents)} bytes, SHA-256: {sha256[:16]}…)"))

    await db.commit()
    await db.refresh(scan)
    return {"scan_id": scan.id, "sha256": sha256, "size_bytes": len(contents)}


# ---------------------------------------------------------------------------
# POST /api/scans/{scan_id}/start — queue scan for worker
# ---------------------------------------------------------------------------

@router.post("/{scan_id}/start")
async def start_scan(
    scan_id: str,
    body: ScanStartRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    if scan.status != ScanStatus.uploaded.value:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Cannot start scan in '{scan.status}' state")

    scan.profile = body.profile
    scan.status = ScanStatus.queued.value
    scan.started_at = _utcnow()

    # Create job for worker to claim
    job = Job(scan_id=scan_id)
    db.add(job)
    db.add(LogEntry(scan_id=scan_id, stage="queued", message=f"Scan queued with profile '{body.profile}'"))

    await db.commit()
    await db.refresh(scan)
    return {"scan_id": scan.id, "status": scan.status}


# ---------------------------------------------------------------------------
# GET /api/scans — list scans (dashboard)
# ---------------------------------------------------------------------------

@router.get("")
async def list_scans(db: AsyncSession = Depends(get_db)) -> list[ScanSummary]:
    result = await db.execute(
        select(Scan).order_by(Scan.created_at.desc()).limit(50)
    )
    scans = result.scalars().all()

    summaries = []
    for s in scans:
        # Get highest severity finding for this scan
        findings_result = await db.execute(
            select(Finding.severity).where(Finding.scan_id == s.id)
        )
        severities = [r[0] for r in findings_result.all()]
        highest = _highest_severity(severities) if severities else None

        summaries.append(ScanSummary(
            id=s.id,
            apk_filename=s.apk_filename,
            status=s.status,
            progress=s.progress,
            highest_severity=highest,
            created_at=s.created_at,
        ))
    return summaries


def _highest_severity(severities: list[str]) -> str | None:
    order = ["Critical", "High", "Medium", "Low", "Informational"]
    for level in order:
        if level in severities:
            return level
    return severities[0] if severities else None


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id} — full detail
# ---------------------------------------------------------------------------

@router.get("/{scan_id}")
async def get_scan(scan_id: str, db: AsyncSession = Depends(get_db)) -> ScanDetail:
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    return ScanDetail(
        id=scan.id,
        apk_filename=scan.apk_filename,
        apk_size_bytes=scan.apk_size_bytes,
        sha256=scan.sha256,
        package_name=scan.package_name,
        version=scan.version,
        profile=scan.profile,
        status=scan.status,
        progress=scan.progress,
        current_stage=scan.current_stage,
        error_message=scan.error_message,
        created_at=scan.created_at,
        started_at=scan.started_at,
        completed_at=scan.completed_at,
    )


def _normalize_dt(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/status — lightweight polling payload
# ---------------------------------------------------------------------------

@router.get("/{scan_id}/status")
async def get_scan_status(scan_id: str, db: AsyncSession = Depends(get_db)) -> ScanStatusResponse:
    result = await db.execute(
        select(Scan).options(selectinload(Scan.job)).where(Scan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")

    worker_last_seen_seconds_ago = None
    if scan.job and scan.job.worker_last_seen:
        last_seen = _normalize_dt(scan.job.worker_last_seen)
        if last_seen:
            delta = _utcnow() - last_seen
            worker_last_seen_seconds_ago = max(0, int(delta.total_seconds()))

    return ScanStatusResponse(
        scan_id=scan.id,
        status=scan.status,
        progress=scan.progress,
        current_stage=scan.current_stage,
        started_at=scan.started_at,
        error_message=scan.error_message,
        worker_last_seen_seconds_ago=worker_last_seen_seconds_ago,
    )


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/findings
# ---------------------------------------------------------------------------

@router.get("/{scan_id}/findings")
async def get_findings(scan_id: str, db: AsyncSession = Depends(get_db)) -> FindingsResponse:
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")

    result = await db.execute(select(Finding).where(Finding.scan_id == scan_id))
    findings = result.scalars().all()

    return FindingsResponse(
        scan_id=scan_id,
        findings=[
            FindingSchema(
                id=f.id,
                severity=f.severity,
                title=f.title,
                category=f.category,
                description=f.description,
                evidence=f.evidence,
                affected_component=f.affected_component,
                recommendation=f.recommendation,
                confidence=f.confidence,
                source=f.source,
            )
            for f in findings
        ],
    )


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/logs
# ---------------------------------------------------------------------------

@router.get("/{scan_id}/logs")
async def get_logs(
    scan_id: str,
    stage: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> LogsResponse:
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")

    query = select(LogEntry).where(LogEntry.scan_id == scan_id).order_by(LogEntry.timestamp)
    if stage:
        query = query.where(LogEntry.stage == stage)
    result = await db.execute(query)
    logs = result.scalars().all()

    return LogsResponse(
        scan_id=scan_id,
        logs=[
            LogEntrySchema(timestamp=l.timestamp, stage=l.stage, message=l.message)
            for l in logs
        ],
    )


# ---------------------------------------------------------------------------
# GET /api/scans/{scan_id}/report
# ---------------------------------------------------------------------------

@router.get("/{scan_id}/report")
async def get_report(scan_id: str, db: AsyncSession = Depends(get_db)) -> ReportResponse:
    scan = await db.get(Scan, scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")

    return ReportResponse(
        scan_id=scan_id,
        generated_at=scan.completed_at,
        html=scan.report_html,
    )
