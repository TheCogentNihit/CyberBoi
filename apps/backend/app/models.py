"""CyberShield Backend — SQLAlchemy models."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------------------
# Scan status enum — single source of truth (mirrors §4 of the spec)
# ---------------------------------------------------------------------------

class ScanStatus(str, enum.Enum):
    created = "created"
    uploaded = "uploaded"
    queued = "queued"
    running_static = "running_static"
    running_dynamic = "running_dynamic"
    running_network = "running_network"
    running_rag = "running_rag"
    generating_report = "generating_report"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


TERMINAL_STATUSES = {ScanStatus.completed, ScanStatus.failed, ScanStatus.cancelled}

RUNNING_STATUSES = {
    ScanStatus.queued,
    ScanStatus.running_static,
    ScanStatus.running_dynamic,
    ScanStatus.running_network,
    ScanStatus.running_rag,
    ScanStatus.generating_report,
}


class ScanProfile(str, enum.Enum):
    quick = "quick"
    standard = "standard"
    full = "full"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[str] = mapped_column(String(24), primary_key=True, default=_new_id)
    apk_filename: Mapped[str | None] = mapped_column(String(512), default=None)
    apk_size_bytes: Mapped[int | None] = mapped_column(Integer, default=None)
    sha256: Mapped[str | None] = mapped_column(String(64), default=None)
    package_name: Mapped[str | None] = mapped_column(String(512), default=None)
    version: Mapped[str | None] = mapped_column(String(128), default=None)
    profile: Mapped[str] = mapped_column(String(16), default=ScanProfile.full.value)
    status: Mapped[str] = mapped_column(
        String(32), default=ScanStatus.created.value, index=True
    )
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_stage: Mapped[str | None] = mapped_column(String(64), default=None)
    error_message: Mapped[str | None] = mapped_column(Text, default=None)
    report_html: Mapped[str | None] = mapped_column(Text, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    # Relationships
    findings: Mapped[list[Finding]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    logs: Mapped[list[LogEntry]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    job: Mapped[Job | None] = relationship(back_populates="scan", uselist=False, cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String(24), primary_key=True, default=_new_id)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"), index=True)
    severity: Mapped[str] = mapped_column(String(16))  # Critical/High/Medium/Low/Informational
    title: Mapped[str] = mapped_column(String(512))
    category: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str | None] = mapped_column(Text, default=None)
    affected_component: Mapped[str | None] = mapped_column(String(512), default=None)
    recommendation: Mapped[str | None] = mapped_column(Text, default=None)
    confidence: Mapped[str] = mapped_column(String(16), default="medium")
    source: Mapped[str] = mapped_column(String(32), default="static_analysis")

    scan: Mapped[Scan] = relationship(back_populates="findings")


class LogEntry(Base):
    __tablename__ = "log_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    stage: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(Text)

    scan: Mapped[Scan] = relationship(back_populates="logs")


class Job(Base):
    """A worker job linked 1:1 with a scan. Created when scan is started."""
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(24), primary_key=True, default=_new_id)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id"), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending / claimed / completed / failed
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    worker_last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    scan: Mapped[Scan] = relationship(back_populates="job")
