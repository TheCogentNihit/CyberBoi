"""CyberShield Backend — FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import CORS_ORIGINS, CORS_ORIGIN_REGEX, UPLOAD_DIR
from app.database import init_db
from app.routers import health, scans, worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    await init_db()
    yield


app = FastAPI(
    title="CyberShield API",
    description="APK security analysis platform — backend API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — supports configured domains + Vercel deployment preview regex
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX if CORS_ORIGIN_REGEX else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(health.router)
app.include_router(scans.router)
app.include_router(worker.router)


# ---------------------------------------------------------------------------
# APK download endpoint (worker downloads APK from here)
# ---------------------------------------------------------------------------

@app.get("/api/scans/{scan_id}/download")
async def download_apk(scan_id: str):
    """Serve the uploaded APK file for the worker to download."""
    apk_path = UPLOAD_DIR / scan_id / "input.apk"
    if not apk_path.exists():
        from fastapi import HTTPException, status
        raise HTTPException(status.HTTP_404_NOT_FOUND, "APK file not found")
    return FileResponse(
        path=str(apk_path),
        media_type="application/vnd.android.package-archive",
        filename=f"{scan_id}.apk",
    )
