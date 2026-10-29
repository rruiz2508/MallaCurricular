from collections.abc import AsyncIterator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    url = get_settings().database_url
    if not url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL no está configurada",
        )
    # statement_cache_size=0 permite usar el pooler de Supabase en modo transaction.
    return create_async_engine(url, pool_pre_ping=True, connect_args={"statement_cache_size": 0})


async def get_connection() -> AsyncIterator[AsyncConnection]:
    async with get_engine().begin() as conn:
        yield conn
