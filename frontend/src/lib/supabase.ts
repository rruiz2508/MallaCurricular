/**
 * Cliente de Supabase, usado únicamente para autenticación (login, sesión, logout).
 * Los datos académicos NO se leen desde aquí: el frontend consume solo la API del
 * backend. La clave "publishable" es pública por diseño; los secretos nunca van aquí.
 * Los valores se definen en `.env.local` (ver `.env.example`).
 */
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
);
