/**
 * Tema claro/oscuro.
 *
 * El tema activo se guarda como atributo `data-theme` en `<html>`; index.css define los
 * colores de cada uno. La preferencia del usuario se persiste en `localStorage`; si no
 * hay ninguna guardada se respeta la configuración del sistema operativo.
 */
import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/** Tema guardado o, en su defecto, el del sistema. `localStorage` puede no estar disponible. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* almacenamiento bloqueado: se usa la preferencia del sistema */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Tema actual y función para alternarlo (aplica el cambio y lo persiste). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme | undefined) ?? initialTheme(),
  );
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* sin persistencia: el cambio sigue valiendo para esta sesión */
    }
    setTheme(next);
  }, [theme]);
  return { theme, toggle };
}
