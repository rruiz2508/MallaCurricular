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

/** Etiquetas legibles de los campos que más se validan; el resto se muestra tal cual. */
const FIELD_LABELS: Record<string, string> = {
  codigo: "Código",
  codigo_sistema: "Código de sistema",
  nombre: "Nombre",
  descripcion: "Descripción",
  carga_horaria_total: "Carga horaria total",
  horas_teoricas: "Horas teóricas",
  horas_practicas: "Horas prácticas",
  duracion_semestres: "Duración (semestres)",
  titulo_otorgado: "Título otorgado",
  anio: "Año",
  anios_gracia: "Años de gracia",
  observacion: "Observación",
};

/**
 * Convierte los errores de validación de FastAPI (422, lista de `{ loc, msg }`) en un texto
 * en español. Sin esto la interfaz solo mostraba "Unprocessable Content".
 */
function formatValidation(items: unknown[]): string {
  const messages = items.map((raw) => {
    const item = raw as { loc?: unknown[]; msg?: string; type?: string };
    // "Value error, ..." es el prefijo que Pydantic antepone a los ValueError propios.
    const msg = (item.msg ?? "Dato inválido").replace(/^Value error, /, "");
    const field = [...(item.loc ?? [])].reverse().find((p) => typeof p === "string") as
      | string
      | undefined;
    // Los errores que pertenecen a todo el objeto (validadores propios) ya traen su frase completa.
    if (!field || field === "body" || item.type === "value_error") return msg;
    return `${FIELD_LABELS[field] ?? field}: ${msg}`;
  });
  return [...new Set(messages)].join(". ");
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
      else if (Array.isArray(body.detail)) detail = formatValidation(body.detail);
    } catch {
      /* respuesta sin cuerpo JSON: se queda el texto de estado HTTP */
    }
    throw new ApiError(response.status, detail);
  }
  // 204 No Content no trae cuerpo que parsear.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
