/**
 * Módulo de usuarios: tabla con alta, edición (datos, estado y roles) y cambio de
 * contraseña mediante ventanas modales.
 *
 * El alta crea la cuenta en Supabase Auth a través del backend (que es quien tiene la
 * clave secreta); desde aquí nunca se maneja esa clave.
 */
import { KeyRound, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

interface RolRef {
  id: string;
  nombre: string;
}

interface RolDisponible extends RolRef {
  descripcion: string | null;
}

interface Usuario {
  id: string;
  email: string | null;
  nombre: string;
  apellido: string;
  activo: boolean;
  roles: RolRef[];
}

/** Datos del formulario modal. Con `id` se edita un usuario; sin `id` se crea uno. */
interface Draft {
  id?: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  roles: string[];
}

/** Datos de la ventana de cambio de contraseña. */
interface PasswordDraft {
  id: string;
  email: string | null;
  password: string;
}

export default function Usuarios() {
  const { can, me } = useAuth();
  const canManage = can("usuarios.gestionar");
  const [items, setItems] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<RolDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** null = modal cerrado. */
  const [draft, setDraft] = useState<Draft | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<PasswordDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /** Pide usuarios y roles asignables al backend. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api<Usuario[]>("/usuarios"),
        api<RolDisponible[]>("/usuarios/roles"),
      ]);
      setItems(u);
      setRoles(r);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function open(next: Draft) {
    setFormError(null);
    setDraft(next);
  }

  function toggleRol(id: string, marcado: boolean) {
    if (!draft) return;
    const set = new Set(draft.roles);
    if (marcado) set.add(id);
    else set.delete(id);
    setDraft({ ...draft, roles: [...set] });
  }

  /** Guarda el formulario: PATCH si es edición, POST si es alta; luego recarga. */
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    try {
      if (draft.id) {
        await api(`/usuarios/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            nombre: draft.nombre,
            apellido: draft.apellido,
            activo: draft.activo,
            roles: draft.roles,
          }),
        });
      } else {
        await api("/usuarios", {
          method: "POST",
          body: JSON.stringify({
            email: draft.email,
            password: draft.password,
            nombre: draft.nombre,
            apellido: draft.apellido,
            roles: draft.roles,
          }),
        });
      }
      setDraft(null);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (!passwordDraft) return;
    setFormError(null);
    try {
      await api(`/usuarios/${passwordDraft.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: passwordDraft.password }),
      });
      setPasswordDraft(null);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Usuarios</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() =>
              open({
                email: "",
                password: "",
                nombre: "",
                apellido: "",
                activo: true,
                roles: [],
              })
            }
          >
            <Plus size={16} /> Nuevo usuario
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Roles</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{`${u.nombre} ${u.apellido}`.trim() || "—"}</td>
                  <td>{u.email}</td>
                  <td>
                    {u.roles.length === 0 ? (
                      <span className="muted">Sin roles</span>
                    ) : (
                      u.roles.map((r) => (
                        <span key={r.id} className="badge off role-badge">
                          {r.nombre}
                        </span>
                      ))
                    )}
                  </td>
                  <td>
                    <span className={`badge ${u.activo ? "ok" : "off"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() =>
                          open({
                            id: u.id,
                            email: u.email ?? "",
                            password: "",
                            nombre: u.nombre,
                            apellido: u.apellido,
                            activo: u.activo,
                            roles: u.roles.map((r) => r.id),
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Cambiar contraseña"
                        onClick={() => {
                          setFormError(null);
                          setPasswordDraft({ id: u.id, email: u.email, password: "" });
                        }}
                      >
                        <KeyRound size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    Aún no hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{draft.id ? "Editar usuario" : "Nuevo usuario"}</h2>
            <label>
              Correo
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                disabled={!!draft.id}
                required
              />
            </label>
            {!draft.id && (
              <label>
                Contraseña (mínimo 8 caracteres)
                <input
                  type="password"
                  value={draft.password}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            )}
            <label>
              Nombre
              <input
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                required
              />
            </label>
            <label>
              Apellido
              <input
                value={draft.apellido}
                onChange={(e) => setDraft({ ...draft, apellido: e.target.value })}
              />
            </label>
            {draft.id && (
              <label className="check">
                <input
                  type="checkbox"
                  checked={draft.activo}
                  // Nadie puede desactivarse a sí mismo (el backend también lo impide).
                  disabled={draft.id === me?.id}
                  onChange={(e) => setDraft({ ...draft, activo: e.target.checked })}
                />
                Activo
              </label>
            )}
            <fieldset className="perm-group">
              <legend>Roles</legend>
              {roles.map((r) => (
                <label key={r.id} className="check" title={r.descripcion ?? undefined}>
                  <input
                    type="checkbox"
                    checked={draft.roles.includes(r.id)}
                    onChange={(e) => toggleRol(r.id, e.target.checked)}
                  />
                  {r.nombre}
                </label>
              ))}
            </fieldset>
            {formError && <p className="error">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setDraft(null)}>
                Cancelar
              </button>
              <button className="btn primary">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {passwordDraft && (
        <div className="modal-backdrop" onClick={() => setPasswordDraft(null)}>
          <form
            className="card modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={savePassword}
          >
            <h2>Cambiar contraseña</h2>
            <p className="muted">{passwordDraft.email}</p>
            <label>
              Nueva contraseña (mínimo 8 caracteres)
              <input
                type="password"
                value={passwordDraft.password}
                onChange={(e) => setPasswordDraft({ ...passwordDraft, password: e.target.value })}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {formError && <p className="error">{formError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setPasswordDraft(null)}>
                Cancelar
              </button>
              <button className="btn primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
