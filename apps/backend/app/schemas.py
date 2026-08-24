"""CyberShield Backend — Pydantic schemas (mirrors §4 and §5 JSON shapes)."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Frontend-facing schemas (§4)
# ---------------------------------------------------------------------------

class ScanCreate(BaseModel):
    """POST /api/scans — no body needed, but allow optional metadata."""
    apk_filename: Optional[str] = None


class ScanStartRequest(BaseModel):
    """POST /api/scans/{scan_id}/start"""
    profile: str = Field(default="full", pattern=r"^(quick|standard|full)$")


class ScanSummary(BaseModel):
    """GET /api/scans — list item."""
    id: str
    apk_filename: Optional[str]
    status: str
    progress: int
    highest_severity: Optional[str] = None
    created_at: datetime


class ScanDetail(BaseModel):
    """GET /api/scans/{scan_id} — full detail."""
    id: str
    apk_filename: Optional[str]
    apk_size_bytes: Optional[int]
    sha256: Optional[str]
    package_name: Optional[str]
    version: Optional[str]
    profile: str
    status: str
    progress: int
    current_stage: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]


class ScanStatusResponse(BaseModel):
    """GET /api/scans/{scan_id}/status — lightweight polling payload (§4)."""
    scan_id: str
    status: str
    progress: int
    current_stage: Optional[str]
    started_at: Optional[datetime]
    error_message: Optional[str]
    worker_last_seen_seconds_ago: Optional[int]


class FindingSchema(BaseModel):
    """Single finding in the response."""
    id: str
    severity: str
    title: str
    category: str
    description: str
    evidence: Optional[str] = None
    affected_component: Optional[str] = None
    recommendation: Optional[str] = None
    confidence: str = "medium"
    source: str = "static_analysis"


class FindingsResponse(BaseModel):
    """GET /api/scans/{scan_id}/findings"""
    scan_id: str
    findings: list[FindingSchema]


class LogEntrySchema(BaseModel):
    timestamp: datetime
    stage: str
    message: str


class LogsResponse(BaseModel):
    """GET /api/scans/{scan_id}/logs"""
    scan_id: str
    logs: list[LogEntrySchema]


class ReportResponse(BaseModel):
    """GET /api/scans/{scan_id}/report"""
    scan_id: str
    generated_at: Optional[datetime] = None
    html: Optional[str] = None


# ---------------------------------------------------------------------------
# Worker-facing schemas (§5)
# ---------------------------------------------------------------------------

class JobClaimResponse(BaseModel):
    """200 response from POST /api/worker/jobs/claim"""
    job_id: str
    scan_id: str
    artifact_url: str
    profile: str


class ProgressUpdate(BaseModel):
    """POST /api/worker/jobs/{job_id}/progress"""
    stage: str
    progress: int = Field(ge=0, le=100)
    message: Optional[str] = None


class ResultFinding(BaseModel):
    """A finding submitted by the worker."""
    severity: str
    title: str
    category: str
    description: str
    evidence: Optional[str] = None
    affected_component: Optional[str] = None
    recommendation: Optional[str] = None
    confidence: str = "medium"
    source: str = "dynamic_analysis"


class ResultsPayload(BaseModel):
    """POST /api/worker/jobs/{job_id}/results"""
    findings: list[ResultFinding] = []
    artifacts: list[dict] = []
    report_html: Optional[str] = None


class FailPayload(BaseModel):
    """POST /api/worker/jobs/{job_id}/fail"""
    error_message: str = "Unknown error"
