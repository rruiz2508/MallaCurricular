"""Punto de entrada de la API del Sistema de Gestión de Malla Curricular.

Se ejecuta con::

    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings

app = FastAPI(title="Sistema de Gestión de Malla Curricular", version="0.1.0")

# CORS: permite que el frontend (otro origen en desarrollo) consuma la API desde el
# navegador. Los orígenes autorizados se configuran con CORS_ORIGINS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Todas las rutas de negocio cuelgan de /api/v1 (la API está versionada).
app.include_router(api_router)


@app.get("/health", tags=["sistema"])
async def health() -> dict[str, str]:
    """Comprobación de vida: no usa base de datos ni autenticación."""
    return {"status": "ok"}
