/**
 * Módulo de facultades: tabla con alta y edición mediante una ventana modal.
 *
 * Es el módulo de referencia: los demás (carreras, asignaturas, etc.) pueden seguir el
 * mismo patrón de cargar → listar → editar en modal → recargar.
 */
import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

interface Facultad {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Datos del formulario modal. Con `id` se edita una facultad; sin `id` se crea una. */
type Draft = { id?: string; codigo: string; nombre: string; activo: boolean };

export default function Facultades() {
  const { can } = useAuth();
  // Los botones de alta/edición solo se muestran a quien puede gestionar. El backend
  // vuelve a validar el permiso en cada petición.
  const canManage = can("facultades.gestionar");
  const [items, setItems] = useState<Facultad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** null = modal cerrado. */
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /** Pide la lista de facultades al backend y actualiza la tabla. */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api<Facultad[]>("/facultades"));
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

  /** Guarda el formulario: PATCH si es edición, POST si es alta; luego recarga la tabla. */
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    const body = JSON.stringify({
      codigo: draft.codigo,
      nombre: draft.nombre,
      activo: draft.activo,
    });
    try {
      if (draft.id) await api(`/facultades/${draft.id}`, { method: "PATCH", body });
      else await api("/facultades", { method: "POST", body });
      setDraft(null);
      await load();
    } catch (e) {
      // Se muestra dentro del modal (p. ej. "Ya existe una facultad con ese código").
      setFormError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Facultades</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() => setDraft({ codigo: "", nombre: "", activo: true })}
          >
            <Plus size={16} /> Nueva facultad
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
                <th>Código</th>
                <th>Nombre</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id}>
                  <td>{f.codigo}</td>
                  <td>{f.nombre}</td>
                  <td>
                    <span className={`badge ${f.activo ? "ok" : "off"}`}>
                      {f.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() => setDraft({ ...f })}
                      >
                        <Pencil size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Aún no hay facultades registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de alta/edición. Hacer clic en el fondo lo cierra; el clic dentro del
          formulario no se propaga (stopPropagation) para no cerrarlo por accidente. */}
      {draft && (
        <div className="modal-backdrop" onClick={() => setDraft(null)}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{draft.id ? "Editar facultad" : "Nueva facultad"}</h2>
            <label>
              Código
              <input
                value={draft.codigo}
                onChange={(e) => setDraft({ ...draft, codigo: e.target.value })}
                required
              />
            </label>
            <label>
              Nombre
              <input
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
                required
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.activo}
                onChange={(e) => setDraft({ ...draft, activo: e.target.checked })}
              />
              Activa
            </label>
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
