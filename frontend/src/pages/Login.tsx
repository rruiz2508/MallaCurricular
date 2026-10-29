/**
 * Pantalla de inicio de sesión con correo y contraseña (Supabase Auth).
 *
 * Al iniciar sesión con éxito no hace falta navegar: `AuthProvider` detecta la nueva
 * sesión, carga el perfil y `App` pasa a mostrar la aplicación automáticamente.
 */
import { useState } from "react";
import type { FormEvent } from "react";

import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // `busy` evita envíos repetidos mientras se espera la respuesta.
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Mensaje genérico a propósito: no revela si el correo existe o no.
    if (error) setError("Correo o contraseña incorrectos");
    setBusy(false);
  }

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="brand login-brand">
          <span className="brand-mark">MC</span>
          <span>Malla Curricular</span>
        </div>
        <p className="muted">Ingresa con tu cuenta institucional.</p>
        <label>
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
