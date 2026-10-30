/**
 * Módulo de roles y permisos: tabla de roles con alta, edición y baja.
 *
 * Los permisos son un catálogo fijo del sistema (no se crean desde aquí): en el modal
 * se eligen los que tendrá cada rol, agrupados por módulo. Los roles de sistema no se
 * pueden renombrar ni eliminar, y el administrador conserva siempre todos sus permisos
 * (el backend y la base lo imponen; aquí solo se deshabilitan los controles).
 */
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

interface Rol {
  id: string;
  nombre: string;
  descripcion: string | null;
  es_sistema: boolean;
  activo: boolean;
  permisos: string[];
  usuarios: number;
}

interface Permiso {
  id: string;
  codigo: string;
  modulo: string;
  descripcion: string;
}

/** Datos del formulario modal. Con `id` se edita un rol; sin `id` se crea uno. */
interface Draft {
  id?: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  permisos: string[];
  es_sistema: boolean;
}

const ADMIN = "administrador";

export default function Roles() {
  const { can } = useAuth();
  const canManage = can("roles.gestionar");
  const [roles, setRoles] = useState<Rol[]>([]);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** null = modal cerrado. */
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /** Pide roles y catálogo de permisos al backend. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([api<Rol[]>("/roles"), api<Permiso[]>("/permisos")]);
      setRoles(r);
      setPermisos(p);
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

  /** Permisos agrupados por módulo, en el orden que entrega el backend. */
  const porModulo = useMemo(() => {
    const grupos = new Map<string, Permiso[]>();
    for (const p of permisos) grupos.set(p.modulo, [...(grupos.get(p.modulo) ?? []), p]);
    return [...grupos.entries()];
  }, [permisos]);

  function open(next: Draft) {
    setFormError(null);
    setDraft(next);
  }

  /** Marca o desmarca un permiso en el formulario. */
  function toggle(codigo: string, marcado: boolean) {
    if (!draft) return;
    const set = new Set(draft.permisos);
    if (marcado) set.add(codigo);
    else set.delete(codigo);
    setDraft({ ...draft, permisos: [...set] });
  }

  /** Marca o desmarca todos los permisos de un módulo. */
  function toggleModulo(items: Permiso[], marcado: boolean) {
    if (!draft) return;
    const set = new Set(draft.permisos);
    for (const p of items) {
      if (marcado) set.add(p.codigo);
      else set.delete(p.codigo);
    }
    setDraft({ ...draft, permisos: [...set] });
  }

  /** Guarda el formulario: PATCH si es edición, POST si es alta; luego recarga. */
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    const body = JSON.stringify({
      // El nombre de un rol de sistema no se envía: no se puede cambiar.
      ...(draft.es_sistema ? {} : { nombre: draft.nombre }),
      descripcion: draft.descripcion.trim() || null,
      activo: draft.activo,
      permisos: draft.permisos,
    });
    try {
      if (draft.id) await api(`/roles/${draft.id}`, { method: "PATCH", body });
      else await api("/roles", { method: "POST", body });
      setDraft(null);
      await load();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function remove(rol: Rol) {
    if (!window.confirm(`¿Eliminar el rol "${rol.nombre}"?`)) return;
    try {
      await api(`/roles/${rol.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const esAdmin = draft?.nombre === ADMIN && draft.es_sistema;

  return (
    <>
      <div className="page-head">
        <h1>Roles y permisos</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() =>
              open({
                nombre: "",
                descripcion: "",
                activo: true,
                permisos: [],
                es_sistema: false,
              })
            }
          >
            <Plus size={16} /> Nuevo rol
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
                <th>Rol</th>
                <th>Descripción</th>
                <th>Permisos</th>
                <th>Usuarios</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.nombre}{" "}
                    {r.es_sistema && <span className="badge off">sistema</span>}
                  </td>
                  <td className="muted">{r.descripcion}</td>
                  <td>{r.permisos.length}</td>
                  <td>{r.usuarios}</td>
                  <td>
                    <span className={`badge ${r.activo ? "ok" : "off"}`}>
                      {r.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() =>
                          open({
                            id: r.id,
                            nombre: r.nombre,
                            descripcion: r.descripcion ?? "",
                            activo: r.activo,
                            permisos: r.permisos,
                            es_sistema: r.es_sistema,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      {!r.es_sistema && (
                        <button
                          className="icon-btn"
                          aria-label="Eliminar"
                          onClick={() => void remove(r)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Aún no hay roles registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <form className="card modal wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{draft.id ? "Editar rol" : "Nuevo rol"}</h2>
            <label>
              Nombre
              <input
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                disabled={draft.es_sistema}
                required
              />
            </label>
            <label>
              Descripción
              <input
                value={draft.descripcion}
                onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.activo}
                disabled={esAdmin}
                onChange={(e) => setDraft({ ...draft, activo: e.target.checked })}
              />
              Activo
            </label>

            <h3>Permisos</h3>
            {esAdmin && (
              <p className="muted">El administrador conserva siempre todos los permisos.</p>
            )}
            <div className="perm-groups">
              {porModulo.map(([modulo, items]) => {
                const todos = items.every((p) => draft.permisos.includes(p.codigo));
                return (
                  <fieldset key={modulo} className="perm-group" disabled={esAdmin}>
                    <legend>
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={todos}
                          onChange={(e) => toggleModulo(items, e.target.checked)}
                        />
                        {modulo}
                      </label>
                    </legend>
                    {items.map((p) => (
                      <label key={p.id} className="check" title={p.codigo}>
                        <input
                          type="checkbox"
                          checked={draft.permisos.includes(p.codigo)}
                          onChange={(e) => toggle(p.codigo, e.target.checked)}
                        />
                        {p.descripcion}
                      </label>
                    ))}
                  </fieldset>
                );
              })}
            </div>

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
    </>
  );
}
