"""Endpoint de sesión: informa quién es el usuario autenticado y qué puede hacer."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["sesión"])


class MeOut(BaseModel):
    """Perfil del usuario actual. El frontend usa ``permisos`` para decidir qué mostrar."""

    id: str
    email: str | None
    nombre: str
    apellido: str
    roles: list[str]
    permisos: list[str]


@router.get("/me", response_model=MeOut)
async def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> MeOut:
    """Devuelve el perfil, los roles y los permisos del usuario del token."""
    return MeOut(
        id=str(user.id),
        email=user.email,
        nombre=user.nombre,
        apellido=user.apellido,
        roles=user.roles,
        permisos=sorted(user.permisos),
    )
