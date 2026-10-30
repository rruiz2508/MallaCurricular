/**
 * Catálogo de asignaturas: búsqueda, alta, edición y baja.
 *
 * La asignatura es independiente de las mallas. La baja lógica es cambiar su estado a
 * "inactiva"; borrarla solo es posible si no forma parte de ninguna malla.
 */
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import { toIntOrNull, useLoad } from "../lib/useLoad";

type Estado = "activa" | "inactiva" | "en_revision";

interface Asignatura {
  id: string;
  codigo: string;
  codigo_sistema: string | null;
  nombre: string;
  descripcion: string | null;
  carga_horaria_total: number;
  horas_teoricas: number | null;
  horas_practicas: number | null;
  estado: Estado;
}

/** Datos del formulario modal. Con `id` se edita una asignatura; sin `id` se crea una. */
interface Draft {
  id?: string;
  codigo: string;
  codigo_sistema: string;
  nombre: string;
  descripcion: string;
  carga_horaria_total: string;
  horas_teoricas: string;
  horas_practicas: string;
  estado: Estado;
}

const estados: Record<Estado, { texto: string; clase: string }> = {
  activa: { texto: "Activa", clase: "ok" },
  en_revision: { texto: "En revisión", clase: "warn" },
  inactiva: { texto: "Inactiva", clase: "off" },
};

export default function Asignaturas() {
  const { can } = useAuth();
  const canManage = can("asignaturas.gestionar");
  const { data, loading, error, reload, setError } = useLoad<Asignatura>("/asignaturas");
  const [busqueda, setBusqueda] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Filtra por código, código de sistema o nombre, sin distinguir mayúsculas.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return data;
    return data.filter((a) =>
      [a.codigo, a.codigo_sistema ?? "", a.nombre].some((t) => t.toLowerCase().includes(q)),
    );
  }, [data, busqueda]);

  function open(next: Draft) {
    setFormError(null);
    setDraft(next);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    const body = JSON.stringify({
      codigo: draft.codigo,
      codigo_sistema: draft.codigo_sistema.trim() || null,
      nombre: draft.nombre,
      descripcion: draft.descripcion.trim() || null,
      carga_horaria_total: Number(draft.carga_horaria_total),
      horas_teoricas: toIntOrNull(draft.horas_teoricas),
      horas_practicas: toIntOrNull(draft.horas_practicas),
      estado: draft.estado,
    });
    try {
      if (draft.id) await api(`/asignaturas/${draft.id}`, { method: "PATCH", body });
      else await api("/asignaturas", { method: "POST", body });
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function remove(a: Asignatura) {
    if (!window.confirm(`¿Eliminar la asignatura "${a.codigo} · ${a.nombre}"?`)) return;
    try {
      await api(`/asignaturas/${a.id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Asignaturas</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() =>
              open({
                codigo: "",
                codigo_sistema: "",
                nombre: "",
                descripcion: "",
                carga_horaria_total: "",
                horas_teoricas: "",
                horas_practicas: "",
                estado: "activa",
              })
            }
          >
            <Plus size={16} /> Nueva asignatura
          </button>
        )}
      </div>

      <div className="toolbar">
        <label className="check">
          <Search size={16} />
          <input
            placeholder="Buscar por código o nombre"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </label>
        <span className="muted">
          {visibles.length} de {data.length}
        </span>
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
                <th>Cód. sistema</th>
                <th>Nombre</th>
                <th>Horas (T / P / total)</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {visibles.map((a) => (
                <tr key={a.id}>
                  <td className="mono">{a.codigo}</td>
                  <td className="muted">{a.codigo_sistema ?? "—"}</td>
                  <td>{a.nombre}</td>
                  <td>
                    {a.horas_teoricas ?? "—"} / {a.horas_practicas ?? "—"} /{" "}
                    <strong>{a.carga_horaria_total}</strong>
                  </td>
                  <td>
                    <span className={`badge ${estados[a.estado].clase}`}>
                      {estados[a.estado].texto}
                    </span>
                  </td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() =>
                          open({
                            id: a.id,
                            codigo: a.codigo,
                            codigo_sistema: a.codigo_sistema ?? "",
                            nombre: a.nombre,
                            descripcion: a.descripcion ?? "",
                            carga_horaria_total: a.carga_horaria_total.toString(),
                            horas_teoricas: a.horas_teoricas?.toString() ?? "",
                            horas_practicas: a.horas_practicas?.toString() ?? "",
                            estado: a.estado,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Eliminar"
                        onClick={() => void remove(a)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No hay asignaturas que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title={draft.id ? "Editar asignatura" : "Nueva asignatura"}
          onClose={() => setDraft(null)}
          onSubmit={save}
          error={formError}
          wide
        >
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
              Código de sistema
              <input
                value={draft.codigo_sistema}
                onChange={(e) => setDraft({ ...draft, codigo_sistema: e.target.value })}
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
            Descripción
            <input
              value={draft.descripcion}
              onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
            />
          </label>
          <div className="row-2">
            <label>
              Carga horaria total
              <input
                type="number"
                min={1}
                value={draft.carga_horaria_total}
                onChange={(e) => setDraft({ ...draft, carga_horaria_total: e.target.value })}
                required
              />
            </label>
            <label>
              Estado
              <select
                value={draft.estado}
                onChange={(e) => setDraft({ ...draft, estado: e.target.value as Estado })}
              >
                {Object.entries(estados).map(([valor, { texto }]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row-2">
            <label>
              Horas teóricas
              <input
                type="number"
                min={0}
                value={draft.horas_teoricas}
                onChange={(e) => setDraft({ ...draft, horas_teoricas: e.target.value })}
              />
            </label>
            <label>
              Horas prácticas
              <input
                type="number"
                min={0}
                value={draft.horas_practicas}
                onChange={(e) => setDraft({ ...draft, horas_practicas: e.target.value })}
              />
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
