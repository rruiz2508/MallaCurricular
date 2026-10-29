/**
 * Cliente HTTP del backend.
 *
 * Todas las llamadas pasan por `api()`, que agrega el token de la sesión de Supabase
 * y traduce los errores del backend a excepciones con un mensaje legible. Las rutas
 * son relativas a `/api/v1`; en desarrollo Vite las redirige al backend (ver
 * vite.config.ts), por lo que no hay problemas de CORS.
 */
import { supabase } from "./supabase";

/** Error de una respuesta no exitosa del backend, con su código HTTP. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Llama a `/api/v1<path>` y devuelve el cuerpo JSON tipado como `T`.
 * Lanza `ApiError` si la respuesta no es 2xx, usando el campo `detail` del backend.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Se lee la sesión en cada llamada para usar siempre el token vigente: Supabase lo
  // renueva automáticamente antes de que venza.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      // FastAPI devuelve los errores como { "detail": "mensaje" }.
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* respuesta sin cuerpo JSON: se queda el texto de estado HTTP */
    }
    throw new ApiError(response.status, detail);
  }
  // 204 No Content no trae cuerpo que parsear.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
