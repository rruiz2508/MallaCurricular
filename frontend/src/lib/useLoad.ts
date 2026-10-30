/**
 * Carga de una lista desde el backend con estado de carga y de error.
 *
 * `optional` sirve para listas auxiliares (p. ej. las facultades de un selector): si el
 * usuario no tiene permiso para verlas o falla la petición, se devuelve una lista vacía
 * en lugar de romper toda la pantalla.
 */
import { useCallback, useEffect, useState } from "react";

import { api } from "./api";

export function useLoad<T>(path: string, options: { optional?: boolean } = {}) {
  const { optional = false } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<T[]>(path));
      setError(null);
    } catch (e) {
      setData([]);
      setError(optional ? null : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path, optional]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, setError };
}

/** Convierte el texto de un campo numérico opcional: vacío -> null. */
export function toIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}
