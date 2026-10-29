from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.security import CurrentUser, get_current_user

router = APIRouter(tags=["sesión"])


class MeOut(BaseModel):
    id: str
    email: str | None
    nombre: str
    apellido: str
    roles: list[str]
    permisos: list[str]


@router.get("/me", response_model=MeOut)
async def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> MeOut:
    return MeOut(
        id=str(user.id),
        email=user.email,
        nombre=user.nombre,
        apellido=user.apellido,
        roles=user.roles,
        permisos=sorted(user.permisos),
    )
