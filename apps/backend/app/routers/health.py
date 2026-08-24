"""CyberShield Backend — Health check endpoint."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "service": "cybershield-backend"}
