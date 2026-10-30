/**
 * Mallas curriculares: lista de versiones por carrera, con alta, nueva versión (copia) y
 * baja de borradores. La composición por semestre y los prerrequisitos se editan en el
 * detalle de cada malla (MallaDetalle).
 */
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import { estadoMallaBadge } from "../lib/types";
import type { Malla, MallaDetalle } from "../lib/types";
import { useLoad } from "../lib/useLoad";

interface Carrera {
  id: string;
  codigo: string;
  nombre: string;
  duracion_semestres: number | null;
  activo: boolean;
}

interface Draft {
  carrera_id: string;
  nombre: string;
  resolucion: string;
  duracion_semestres: string;
  horas_por_credito: string;
}

export default function Mallas() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canManage = can("mallas.gestionar");
  const mallas = useLoad<Malla>("/mallas");
  const carreras = useLoad<Carrera>("/carreras", { optional: true });
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
    try {
      const creada = await api<MallaDetalle>("/mallas", {
        method: "POST",
        body: JSON.stringify({
          carrera_id: draft.carrera_id,
          nombre: draft.nombre,
          resolucion: draft.resolucion.trim() || null,
          duracion_semestres: Number(draft.duracion_semestres),
          horas_por_credito: Number(draft.horas_por_credito),
        }),
      });
      // Una malla nueva está vacía: se abre directamente para empezar a armarla.
      navigate(`/academico/mallas/${creada.id}`);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function clonar(m: Malla) {
    if (!window.confirm(`¿Crear una nueva versión (borrador) copiando "${m.nombre}" v${m.version}?`))
      return;
    try {
      const nueva = await api<MallaDetalle>(`/mallas/${m.id}/clonar`, { method: "POST" });
      navigate(`/academico/mallas/${nueva.id}`);
    } catch (e) {
      mallas.setError((e as Error).message);
    }
  }

  async function remove(m: Malla) {
    if (!window.confirm(`¿Eliminar el borrador "${m.nombre}" v${m.version}?`)) return;
    try {
      await api(`/mallas/${m.id}`, { method: "DELETE" });
      await mallas.reload();
    } catch (e) {
      mallas.setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Mallas curriculares</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() => {
              const carrera = carreras.data.find((c) => c.activo);
              open({
                carrera_id: carrera?.id ?? "",
                nombre: "",
                resolucion: "",
                duracion_semestres: carrera?.duracion_semestres?.toString() ?? "",
                horas_por_credito: "15",
              });
            }}
          >
            <Plus size={16} /> Nueva malla
          </button>
        )}
      </div>

      {mallas.error && <p className="error">{mallas.error}</p>}
      {mallas.loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Carrera</th>
                <th>Versión</th>
                <th>Nombre</th>
                <th>Semestres</th>
                <th>Asignaturas</th>
                <th>Promociones</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mallas.data.map((m) => {
                const badge = estadoMallaBadge[m.estado];
                return (
                  <tr key={m.id}>
                    <td>
                      <span className="mono">{m.carrera_codigo}</span>
                    </td>
                    <td>v{m.version}</td>
                    <td>
                      <Link to={`/academico/mallas/${m.id}`}>{m.nombre}</Link>
                    </td>
                    <td>{m.duracion_semestres}</td>
                    <td>{m.cantidad_asignaturas}</td>
                    <td>{m.cantidad_promociones}</td>
                    <td>
                      <span className={`badge ${badge.clase}`}>{badge.texto}</span>
                    </td>
                    <td className="actions">
                      <Link
                        className="icon-btn"
                        aria-label="Abrir"
                        title="Abrir"
                        to={`/academico/mallas/${m.id}`}
                      >
                        <ExternalLink size={16} />
                      </Link>
                      {canManage && (
                        <button
                          className="icon-btn"
                          aria-label="Nueva versión"
                          title="Nueva versión (copia en borrador)"
                          onClick={() => void clonar(m)}
                        >
                          <Copy size={16} />
                        </button>
                      )}
                      {canManage && m.estado === "borrador" && (
                        <button
                          className="icon-btn"
                          aria-label="Eliminar"
                          onClick={() => void remove(m)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {mallas.data.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
                    Aún no hay mallas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title="Nueva malla"
          onClose={() => setDraft(null)}
          onSubmit={save}
          error={formError}
          submitLabel="Crear"
        >
          <p className="muted">
            Se crea como borrador con la siguiente versión de la carrera. Luego se arma por
            semestres y se publica.
          </p>
          <label>
            Carrera
            <select
              value={draft.carrera_id}
              onChange={(e) => {
                const carrera = carreras.data.find((c) => c.id === e.target.value);
                setDraft({
                  ...draft,
                  carrera_id: e.target.value,
                  duracion_semestres: carrera?.duracion_semestres?.toString() ?? draft.duracion_semestres,
                });
              }}
              required
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {carreras.data
                .filter((c) => c.activo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} · {c.nombre}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Nombre
            <input
              value={draft.nombre}
              onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              required
            />
          </label>
          <label>
            Resolución
            <input
              value={draft.resolucion}
              onChange={(e) => setDraft({ ...draft, resolucion: e.target.value })}
            />
          </label>
          <div className="row-2">
            <label>
              Duración (semestres)
              <input
                type="number"
                min={1}
                max={20}
                value={draft.duracion_semestres}
                onChange={(e) => setDraft({ ...draft, duracion_semestres: e.target.value })}
                required
              />
            </label>
            <label>
              Horas por crédito
              <input
                type="number"
                min={1}
                max={100}
                value={draft.horas_por_credito}
                onChange={(e) => setDraft({ ...draft, horas_por_credito: e.target.value })}
                required
              />
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
