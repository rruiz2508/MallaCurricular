/**
 * Módulo de carreras: alta, edición y baja.
 *
 * La baja lógica es desmarcar "Activa"; borrar solo es posible si la carrera no tiene
 * mallas ni promociones (el backend responde 409 en otro caso).
 */
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import { toIntOrNull, useLoad } from "../lib/useLoad";

interface Carrera {
  id: string;
  facultad_id: string;
  facultad: string;
  codigo: string;
  nombre: string;
  titulo_otorgado: string | null;
  duracion_semestres: number | null;
  activo: boolean;
}

interface Facultad {
  id: string;
  nombre: string;
  activo: boolean;
}

/** Datos del formulario modal. Con `id` se edita una carrera; sin `id` se crea una. */
interface Draft {
  id?: string;
  facultad_id: string;
  codigo: string;
  nombre: string;
  titulo_otorgado: string;
  duracion_semestres: string;
  activo: boolean;
}

export default function Carreras() {
  const { can } = useAuth();
  const canManage = can("carreras.gestionar");
  const carreras = useLoad<Carrera>("/carreras");
  const facultades = useLoad<Facultad>("/facultades", { optional: true });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function open(next: Draft) {
    setFormError(null);
    setDraft(next);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    const body = JSON.stringify({
      facultad_id: draft.facultad_id,
      codigo: draft.codigo,
      nombre: draft.nombre,
      titulo_otorgado: draft.titulo_otorgado.trim() || null,
      duracion_semestres: toIntOrNull(draft.duracion_semestres),
      activo: draft.activo,
    });
    try {
      if (draft.id) await api(`/carreras/${draft.id}`, { method: "PATCH", body });
      else await api("/carreras", { method: "POST", body });
      setDraft(null);
      await carreras.reload();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function remove(c: Carrera) {
    if (!window.confirm(`¿Eliminar la carrera "${c.nombre}"?`)) return;
    try {
      await api(`/carreras/${c.id}`, { method: "DELETE" });
      await carreras.reload();
    } catch (e) {
      carreras.setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Carreras</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() =>
              open({
                facultad_id: facultades.data.find((f) => f.activo)?.id ?? "",
                codigo: "",
                nombre: "",
                titulo_otorgado: "",
                duracion_semestres: "",
                activo: true,
              })
            }
          >
            <Plus size={16} /> Nueva carrera
          </button>
        )}
      </div>

      {carreras.error && <p className="error">{carreras.error}</p>}
      {carreras.loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Facultad</th>
                <th>Semestres</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {carreras.data.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.codigo}</td>
                  <td>{c.nombre}</td>
                  <td className="muted">{c.facultad}</td>
                  <td>{c.duracion_semestres ?? "—"}</td>
                  <td>
                    <span className={`badge ${c.activo ? "ok" : "off"}`}>
                      {c.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() =>
                          open({
                            id: c.id,
                            facultad_id: c.facultad_id,
                            codigo: c.codigo,
                            nombre: c.nombre,
                            titulo_otorgado: c.titulo_otorgado ?? "",
                            duracion_semestres: c.duracion_semestres?.toString() ?? "",
                            activo: c.activo,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Eliminar"
                        onClick={() => void remove(c)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {carreras.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Aún no hay carreras registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title={draft.id ? "Editar carrera" : "Nueva carrera"}
          onClose={() => setDraft(null)}
          onSubmit={save}
          error={formError}
        >
          <label>
            Facultad
            <select
              value={draft.facultad_id}
              onChange={(e) => setDraft({ ...draft, facultad_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {/* Una facultad inactiva solo se ofrece si es la actual de la carrera. */}
              {facultades.data
                .filter((f) => f.activo || f.id === draft.facultad_id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nombre}
                  </option>
                ))}
            </select>
          </label>
          <div className="row-2">
            <label>
              Código
              <input
                value={draft.codigo}
                onChange={(e) => setDraft({ ...draft, codigo: e.target.value })}
                required
              />
            </label>
            <label>
              Duración (semestres)
              <input
                type="number"
                min={1}
                max={20}
                value={draft.duracion_semestres}
                onChange={(e) => setDraft({ ...draft, duracion_semestres: e.target.value })}
              />
            </label>
          </div>
          <label>
            Nombre
            <input
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              required
            />
          </label>
          <label>
            Título otorgado
            <input
              value={draft.titulo_otorgado}
              onChange={(e) => setDraft({ ...draft, titulo_otorgado: e.target.value })}
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
        </Modal>
      )}
    </>
  );
}
