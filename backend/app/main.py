"""Punto de entrada de la API del Sistema de Gestión de Malla Curricular.

Se ejecuta con::

    uvicorn app.main:app --reload
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

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


# --- Modo autónomo -----------------------------------------------------------------------
# Si el frontend está compilado (``npm run build`` genera frontend/dist), este mismo proceso
# lo sirve en la raíz: basta ``uvicorn app.main:app`` (o ``iniciar.bat``) para usar el sistema
# en http://localhost:8000, sin servidor de desarrollo de Vite ni IDE. Con ``dist`` ausente
# (desarrollo normal) no se registra nada y todo funciona como antes.
_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if (_DIST / "index.html").is_file():
    if (_DIST / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{ruta:path}", include_in_schema=False)
    async def frontend(ruta: str) -> FileResponse:
        """Sirve un archivo estático o, para las rutas de la SPA (React Router), index.html."""
        if ruta.startswith(("api/", "health")):
            # Una ruta de API inexistente debe seguir siendo un 404 JSON, no la página.
            raise HTTPException(status_code=404, detail="No encontrado")
        archivo = (_DIST / ruta).resolve()
        if ruta and archivo.is_file() and _DIST.resolve() in archivo.parents:
            return FileResponse(archivo)
        return FileResponse(_DIST / "index.html")
