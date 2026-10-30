"""Router raíz de la versión 1 de la API.

Cada módulo funcional define su propio router y se registra aquí. Para agregar un
módulo nuevo (carreras, asignaturas, etc.) basta con crear su archivo e incluirlo.
"""

from fastapi import APIRouter

from app.api.v1 import (
    asignaturas,
    carreras,
    facultades,
    mallas,
    me,
    promociones,
    roles,
    usuarios,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(me.router)
api_router.include_router(facultades.router)
api_router.include_router(roles.router)
api_router.include_router(usuarios.router)
api_router.include_router(carreras.router)
api_router.include_router(asignaturas.router)
api_router.include_router(mallas.router)
api_router.include_router(promociones.router)
