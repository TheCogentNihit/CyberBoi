"""CyberShield Backend — Worker authentication dependency."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import WORKER_API_KEY

_bearer_scheme = HTTPBearer()


async def verify_worker_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> str:
    """Validate the bearer token against WORKER_API_KEY.

    Returns the token on success; raises 401/403 on failure.
    """
    if not WORKER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="WORKER_API_KEY is not configured on the server.",
        )
    if credentials.credentials != WORKER_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid worker API key.",
        )
    return credentials.credentials
