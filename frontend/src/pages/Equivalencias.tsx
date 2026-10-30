/**
 * Equivalencias entre asignaturas (p. ej. entre versiones de una malla).
 *
 * La relación es simétrica: A equivale a B es lo mismo que B equivale a A, y se guarda
 * una sola vez. Al elegir el par solo importa qué asignaturas son, no el orden.
 */
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import { useLoad } from "../lib/useLoad";

interface Equivalencia {
  asignatura_id: string;
  asignatura_codigo: string;
  asignatura_nombre: string;
  equivalente_id: string;
  equivalente_codigo: string;
  equivalente_nombre: string;
  observacion: string | null;
}

interface Asignatura {
  id: string;
  codigo: string;
  nombre: string;
}

/** Con `editando` solo se cambia la observación; sin él se crea un par nuevo. */
interface Draft {
  editando?: { a: string; b: string };
  asignatura_id: string;
  equivalente_id: string;
  observacion: string;
}

export default function Equivalencias() {
  const { can } = useAuth();
  const canManage = can("asignaturas.gestionar");
  const equivalencias = useLoad<Equivalencia>("/equivalencias");
  const asignaturas = useLoad<Asignatura>("/asignaturas", { optional: true });
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
    const observacion = draft.observacion.trim() || null;
    try {
      if (draft.editando) {
        await api(`/equivalencias/${draft.editando.a}/${draft.editando.b}`, {
          method: "PATCH",
          body: JSON.stringify({ observacion }),
        });
      } else {
        await api("/equivalencias", {
          method: "POST",
          body: JSON.stringify({
            asignatura_id: draft.asignatura_id,
            equivalente_id: draft.equivalente_id,
            observacion,
          }),
        });
      }
      setDraft(null);
      await equivalencias.reload();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function remove(eq: Equivalencia) {
    const par = `${eq.asignatura_codigo} ↔ ${eq.equivalente_codigo}`;
    if (!window.confirm(`¿Quitar la equivalencia ${par}?`)) return;
    try {
      await api(`/equivalencias/${eq.asignatura_id}/${eq.equivalente_id}`, { method: "DELETE" });
      await equivalencias.reload();
    } catch (e) {
      equivalencias.setError((e as Error).message);
    }
  }

  const selector = (label: string, value: string, onChange: (id: string) => void) => (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          Seleccione…
        </option>
        {asignaturas.data.map((a) => (
          <option key={a.id} value={a.id}>
            {a.codigo} · {a.nombre}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="page-head">
        <h1>Equivalencias</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() => open({ asignatura_id: "", equivalente_id: "", observacion: "" })}
          >
            <Plus size={16} /> Nueva equivalencia
          </button>
        )}
      </div>

      {equivalencias.error && <p className="error">{equivalencias.error}</p>}
      {equivalencias.loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Asignatura</th>
                <th>Equivale a</th>
                <th>Observación</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {equivalencias.data.map((eq) => (
                <tr key={`${eq.asignatura_id}-${eq.equivalente_id}`}>
                  <td>
                    <span className="mono">{eq.asignatura_codigo}</span> · {eq.asignatura_nombre}
                  </td>
                  <td>
                    <span className="mono">{eq.equivalente_codigo}</span> · {eq.equivalente_nombre}
                  </td>
                  <td className="muted">{eq.observacion}</td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar observación"
                        onClick={() =>
                          open({
                            editando: { a: eq.asignatura_id, b: eq.equivalente_id },
                            asignatura_id: eq.asignatura_id,
                            equivalente_id: eq.equivalente_id,
                            observacion: eq.observacion ?? "",
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Eliminar"
                        onClick={() => void remove(eq)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {equivalencias.data.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Aún no hay equivalencias registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title={draft.editando ? "Editar equivalencia" : "Nueva equivalencia"}
          onClose={() => setDraft(null)}
          onSubmit={save}
          error={formError}
        >
          {draft.editando ? (
            <p className="muted">
              Solo se puede editar la observación; para cambiar el par, elimínelo y créelo de
              nuevo.
            </p>
          ) : (
            <>
              {selector("Asignatura", draft.asignatura_id, (id) =>
                setDraft({ ...draft, asignatura_id: id }),
              )}
              {selector("Equivale a", draft.equivalente_id, (id) =>
                setDraft({ ...draft, equivalente_id: id }),
              )}
            </>
          )}
          <label>
            Observación
            <input
              value={draft.observacion}
              onChange={(e) => setDraft({ ...draft, observacion: e.target.value })}
            />
          </label>
        </Modal>
      )}
    </>
  );
}
