"""Cliente de la Admin API de Supabase Auth.

Crear usuarios y cambiar contraseñas solo es posible con la clave secreta del proyecto,
por eso estas operaciones viven en el backend. El alta en ``auth.users`` dispara un
trigger que crea la fila de ``seguridad.usuario``; los roles se asignan después.
"""

from uuid import UUID

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

_TIMEOUT = 15.0


def _cliente() -> httpx.AsyncClient:
    """Cliente HTTP apuntando a ``/auth/v1/admin`` con las credenciales del proyecto."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_SERVICE_ROLE_KEY no está configurada",
        )
    key = settings.supabase_service_role_key
    headers = {"apikey": key}
    # La clave legacy (service_role) es un JWT y también debe ir como Bearer; las claves
    # nuevas (sb_secret_...) no son JWT y solo se envían en ``apikey``.
    if key.count(".") == 2:
        headers["Authorization"] = f"Bearer {key}"
    return httpx.AsyncClient(
        base_url=f"{settings.supabase_url.rstrip('/')}/auth/v1/admin",
        headers=headers,
        timeout=_TIMEOUT,
    )


def _error(response: httpx.Response) -> HTTPException:
    """Traduce un error de Supabase Auth a una respuesta de la API."""
    try:
        body = response.json()
    except ValueError:
        body = {}
    codigo = body.get("error_code") or body.get("code")
    mensaje = body.get("msg") or body.get("message") or "Error de Supabase Auth"
    if codigo == "email_exists" or codigo == "user_already_exists":
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Ya existe un usuario con ese correo"
        )
    if codigo == "weak_password":
        return HTTPException(status_code=422, detail=mensaje)
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=f"Supabase Auth rechazó la operación: {mensaje}",
    )


async def _enviar(metodo: str, ruta: str, **kwargs: object) -> httpx.Response:
    """Ejecuta la petición y convierte los fallos de red o de Auth en HTTPException."""
    async with _cliente() as client:
        try:
            response = await client.request(metodo, ruta, **kwargs)  # type: ignore[arg-type]
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No se pudo contactar a Supabase Auth",
            ) from exc
    if response.is_error:
        raise _error(response)
    return response


async def crear_usuario(
    *, email: str, password: str, nombre: str, apellido: str, creado_por: UUID
) -> UUID:
    """Crea el usuario en Supabase Auth (correo ya confirmado) y devuelve su id.

    ``creado_por`` viaja en ``app_metadata`` (solo escribible con la Admin API): el trigger
    de la base lo usa para registrar quién dio de alta la cuenta.
    """
    response = await _enviar(
        "POST",
        "/users",
        json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"nombre": nombre, "apellido": apellido},
            "app_metadata": {"creado_por": str(creado_por)},
        },
    )
    return UUID(response.json()["id"])


async def eliminar_usuario(user_id: UUID) -> None:
    """Elimina el usuario de Supabase Auth (se usa para deshacer un alta incompleta)."""
    await _enviar("DELETE", f"/users/{user_id}")


async def cambiar_password(user_id: UUID, password: str) -> None:
    """Establece una nueva contraseña para el usuario."""
    await _enviar("PUT", f"/users/{user_id}", json={"password": password})
