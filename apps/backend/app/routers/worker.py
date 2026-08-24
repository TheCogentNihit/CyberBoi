"""CyberShield Backend — Worker endpoints (§5)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_worker_token
from app.config import UPLOAD_DIR
from app.database import get_db
from app.models import Finding, Job, LogEntry, Scan, ScanStatus
from app.schemas import (
    FailPayload,
    JobClaimResponse,
    ProgressUpdate,
    ResultsPayload,
)

router = APIRouter(
    prefix="/api/worker",
    tags=["worker"],
    dependencies=[Depends(verify_worker_token)],
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# POST /api/worker/jobs/claim — long-poll ~20s, return job or 204
# ---------------------------------------------------------------------------

@router.post("/jobs/claim")
async def claim_job(
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> JobClaimResponse | None:
    """Long-poll for an available job. Polls DB every 2s for up to 20s."""
    for _ in range(10):  # 10 × 2s = 20s max
        result = await db.execute(
            select(Job)
            .where(Job.status == "pending")
            .order_by(Job.id)
            .limit(1)
        )
        job = result.scalar_one_or_none()

        if job:
            # Claim it
            job.status = "claimed"
            job.claimed_at = _utcnow()
            job.worker_last_seen = _utcnow()

            # Load the linked scan
            scan = await db.get(Scan, job.scan_id)
            if not scan:
                # Orphaned job — skip
                job.status = "failed"
                await db.commit()
                continue

            await db.commit()
            await db.refresh(job)

            # Build artifact URL — the worker will download from here
            artifact_url = f"/api/scans/{scan.id}/download"

            return JobClaimResponse(
                job_id=job.id,
                scan_id=scan.id,
                artifact_url=artifact_url,
                profile=scan.profile,
            )

        await asyncio.sleep(2)

    # No job found after 20s — return 204
    response.status_code = status.HTTP_204_NO_CONTENT
    return None


# ---------------------------------------------------------------------------
# POST /api/worker/jobs/{job_id}/progress
# ---------------------------------------------------------------------------

@router.post("/jobs/{job_id}/progress")
async def update_progress(
    job_id: str,
    body: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    if job.status != "claimed":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Job is in '{job.status}' state")

    job.worker_last_seen = _utcnow()

    # Update the linked scan
    scan = await db.get(Scan, job.scan_id)
    if scan:
        scan.status = body.stage
        scan.progress = body.progress
        scan.current_stage = body.message or body.stage

        if body.message:
            db.add(LogEntry(
                scan_id=scan.id,
                stage=body.stage,
                message=body.message,
            ))

    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /api/worker/jobs/{job_id}/results — submit findings + artifacts
# ---------------------------------------------------------------------------

@router.post("/jobs/{job_id}/results")
async def submit_results(
    job_id: str,
    body: ResultsPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    job.worker_last_seen = _utcnow()

    scan = await db.get(Scan, job.scan_id)
    if not scan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Linked scan not found")

    # Save findings
    for f in body.findings:
        db.add(Finding(
            scan_id=scan.id,
            severity=f.severity,
            title=f.title,
            category=f.category,
            description=f.description,
            evidence=f.evidence,
            affected_component=f.affected_component,
            recommendation=f.recommendation,
            confidence=f.confidence,
            source=f.source,
        ))

    # Save report HTML if provided
    if body.report_html:
        scan.report_html = body.report_html

    db.add(LogEntry(
        scan_id=scan.id,
        stage=scan.status,
        message=f"Worker submitted {len(body.findings)} findings",
    ))

    await db.commit()
    return {"ok": True, "findings_count": len(body.findings)}


# ---------------------------------------------------------------------------
# POST /api/worker/jobs/{job_id}/complete
# ---------------------------------------------------------------------------

@router.post("/jobs/{job_id}/complete")
async def complete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    job.status = "completed"
    job.worker_last_seen = _utcnow()

    scan = await db.get(Scan, job.scan_id)
    if scan:
        scan.status = ScanStatus.completed.value
        scan.progress = 100
        scan.current_stage = "Completed"
        scan.completed_at = _utcnow()
        db.add(LogEntry(scan_id=scan.id, stage="completed", message="Analysis completed successfully"))

    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# POST /api/worker/jobs/{job_id}/fail
# ---------------------------------------------------------------------------

@router.post("/jobs/{job_id}/fail")
async def fail_job(
    job_id: str,
    body: FailPayload,
    db: AsyncSession = Depends(get_db),
) -> dict:
    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    job.status = "failed"
    job.worker_last_seen = _utcnow()

    scan = await db.get(Scan, job.scan_id)
    if scan:
        scan.status = ScanStatus.failed.value
        scan.error_message = body.error_message
        scan.current_stage = "Failed"
        db.add(LogEntry(scan_id=scan.id, stage="failed", message=f"Analysis failed: {body.error_message}"))

    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# GET /api/worker/health — heartbeat
# ---------------------------------------------------------------------------

@router.get("/health")
async def worker_health(db: AsyncSession = Depends(get_db)) -> dict:
    """Worker heartbeat — updates worker_last_seen on all claimed jobs."""
    result = await db.execute(select(Job).where(Job.status == "claimed"))
    jobs = result.scalars().all()
    for job in jobs:
        job.worker_last_seen = _utcnow()
    await db.commit()
    return {"ok": True, "active_jobs": len(jobs)}
