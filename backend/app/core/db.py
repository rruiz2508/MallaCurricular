"""Acceso a la base de datos (PostgreSQL en Supabase) con SQLAlchemy Core asíncrono."""

from collections.abc import AsyncIterator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    """Crea (una sola vez) el motor de conexiones a la base.

    Se crea de forma perezosa, en la primera consulta, para que la aplicación pueda
    arrancar y responder ``/health`` aunque ``DATABASE_URL`` todavía no esté configurada.
    En ese caso las rutas que usan la base responden 503 con un mensaje claro.
    """
    url = get_settings().async_database_url
    if not url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DATABASE_URL no está configurada",
        )
    # statement_cache_size=0 permite usar el pooler de Supabase en modo transaction.
    # pool_pre_ping descarta conexiones caídas antes de usarlas.
    return create_async_engine(url, pool_pre_ping=True, connect_args={"statement_cache_size": 0})


async def get_connection() -> AsyncIterator[AsyncConnection]:
    """Dependencia de FastAPI que entrega una conexión con una transacción abierta.

    ``engine.begin()`` confirma (commit) la transacción si la petición termina bien y la
    revierte (rollback) si se produce una excepción, así cada petición es atómica.
    """
    async with get_engine().begin() as conn:
        yield conn
