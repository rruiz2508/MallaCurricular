/**
 * Contexto de autenticación.
 *
 * Combina dos fuentes:
 *  - La sesión de Supabase Auth (quién inició sesión y su token).
 *  - El perfil del backend (`GET /api/v1/me`): nombre, roles y permisos efectivos.
 *
 * El resto de la app lee este estado con `useAuth()` y consulta permisos con `can()`.
 * Ojo: ocultar botones o menús según permisos es solo comodidad de interfaz; la
 * seguridad real la aplica el backend en cada endpoint.
 */
import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

/** Perfil del usuario tal como lo devuelve el backend en `/me`. */
export interface Me {
  id: string;
  email: string | null;
  nombre: string;
  apellido: string;
  roles: string[];
  /** Códigos de permiso efectivos, p. ej. "facultades.leer". */
  permisos: string[];
}

interface AuthState {
  /** true mientras se resuelve la sesión o se carga el perfil. */
  loading: boolean;
  session: Session | null;
  me: Me | null;
  /** Mensaje de error si falló la carga del perfil (p. ej. backend caído). */
  meError: string | null;
  /** Indica si el usuario actual tiene el permiso dado. */
  can: (permiso: string) => boolean;
  /** Vuelve a pedir el perfil al backend (p. ej. tras un error de red). */
  refresh: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  // Se incrementa para forzar una nueva carga del perfil (botón "Reintentar").
  const [reload, setReload] = useState(0);

  // Paso 1: obtener la sesión inicial (guardada por Supabase en el navegador) y
  // suscribirse a sus cambios (login, logout, renovación del token).
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        // Sin sesión no hay perfil que cargar: terminamos de "cargar" aquí.
        if (!data.session) setLoading(false);
      })
      // Si no se puede leer la sesión guardada se muestra el login en lugar de dejar
      // la aplicación cargando indefinidamente.
      .catch(() => setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        // Cierre de sesión: se descarta el perfil anterior.
        setMe(null);
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Paso 2: cuando hay un usuario, pedir su perfil al backend. Se depende del id y no
  // de toda la sesión para no repetir la petición cada vez que se renueva el token.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    // `cancelled` evita actualizar el estado si el efecto se limpió mientras la
    // petición estaba en vuelo (cambio de usuario o desmontaje).
    let cancelled = false;
    setLoading(true);
    api<Me>("/me")
      .then((result) => {
        if (cancelled) return;
        setMe(result);
        setMeError(null);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setMe(null);
        setMeError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const can = useCallback((permiso: string) => me?.permisos.includes(permiso) ?? false, [me]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // useMemo: el objeto del contexto solo cambia cuando cambia algún dato, para no
  // volver a renderizar a todos los consumidores sin necesidad.
  const value = useMemo(
    () => ({ loading, session, me, meError, can, refresh, signOut }),
    [loading, session, me, meError, can, refresh, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Acceso al estado de autenticación. Solo válido dentro de `AuthProvider`. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
