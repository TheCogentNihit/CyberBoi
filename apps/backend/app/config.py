"""CyberShield Backend — Configuration loader."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

raw_db_url: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./cybershield.db")

# Normalize Postgres URLs for asyncpg if needed
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif raw_db_url.startswith("postgresql://") and "+asyncpg" not in raw_db_url:
    raw_db_url = raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL: str = raw_db_url
UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", "./uploads"))

# Allowed specific origins + support for regex (e.g. Vercel previews)
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,https://cybershield.vercel.app").split(",")
    if origin.strip()
]
CORS_ORIGIN_REGEX: str = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"https://.*\.vercel\.app|https://.*\.trycloudflare\.com"
)

WORKER_API_KEY: str = os.getenv("WORKER_API_KEY", "")
MAX_UPLOAD_SIZE_BYTES: int = 150 * 1024 * 1024  # 150 MB

# Ensure upload directory exists
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
