/**
 * Promociones: cohortes de ingreso de una carrera, cada una asociada a una malla publicada.
 *
 * La vigencia se calcula en la base: año de ingreso + duración de la malla + años de gracia.
 * La carrera y el año no se editan; si se cargaron mal, se elimina y se crea de nuevo.
 */
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import type { Malla } from "../lib/types";
import { useLoad } from "../lib/useLoad";

interface Promocion {
  id: string;
  carrera_id: string;
  carrera_codigo: string;
  carrera: string;
  anio: number;
  malla_id: string;
  malla_version: number;
  malla_nombre: string;
  anios_gracia: number;
  anio_fin_regular: number;
  anio_fin_vigencia: number;
  vigente: boolean;
}

interface Carrera {
  id: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

/** Con `id` se edita (solo malla y años de gracia); sin `id` se crea. */
interface Draft {
  id?: string;
  carrera_id: string;
  anio: string;
  malla_id: string;
  anios_gracia: string;
}

export default function Promociones() {
  const { can } = useAuth();
  const canManage = can("promociones.gestionar");
  const promociones = useLoad<Promocion>("/promociones");
  const carreras = useLoad<Carrera>("/carreras", { optional: true });
  const mallas = useLoad<Malla>("/mallas", { optional: true });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function open(next: Draft) {
    setFormError(null);
    setDraft(next);
  }

  /** Solo las mallas publicadas de la carrera elegida pueden asociarse a una promoción. */
  const mallasDe = (carreraId: string) =>
    mallas.data.filter((m) => m.carrera_id === carreraId && m.estado === "publicada");

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setFormError(null);
    try {
      if (draft.id) {
        await api(`/promociones/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            malla_id: draft.malla_id,
            anios_gracia: Number(draft.anios_gracia),
          }),
        });
      } else {
        await api("/promociones", {
          method: "POST",
          body: JSON.stringify({
            carrera_id: draft.carrera_id,
            anio: Number(draft.anio),
            malla_id: draft.malla_id,
            anios_gracia: Number(draft.anios_gracia),
          }),
        });
      }
      setDraft(null);
      await promociones.reload();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  async function remove(p: Promocion) {
    if (!window.confirm(`¿Eliminar la promoción ${p.anio} de ${p.carrera_codigo}?`)) return;
    try {
      await api(`/promociones/${p.id}`, { method: "DELETE" });
      await promociones.reload();
    } catch (e) {
      promociones.setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Promociones</h1>
        {canManage && (
          <button
            className="btn primary"
            onClick={() =>
              open({
                carrera_id: carreras.data.find((c) => c.activo)?.id ?? "",
                anio: new Date().getFullYear().toString(),
                malla_id: "",
                anios_gracia: "3",
              })
            }
          >
            <Plus size={16} /> Nueva promoción
          </button>
        )}
      </div>

      {promociones.error && <p className="error">{promociones.error}</p>}
      {promociones.loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Carrera</th>
                <th>Promoción</th>
                <th>Malla</th>
                <th>Fin regular</th>
                <th>Vigente hasta</th>
                <th>Estado</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {promociones.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="mono">{p.carrera_codigo}</span>
                  </td>
                  <td>
                    {p.anio}{" "}
                    <span className="muted">(P{String(p.anio % 100).padStart(2, "0")})</span>
                  </td>
                  <td>
                    v{p.malla_version} · {p.malla_nombre}
                  </td>
                  <td>{p.anio_fin_regular}</td>
                  <td>
                    {p.anio_fin_vigencia}{" "}
                    <span className="muted">(+{p.anios_gracia} de gracia)</span>
                  </td>
                  <td>
                    <span className={`badge ${p.vigente ? "ok" : "off"}`}>
                      {p.vigente ? "Vigente" : "Vencida"}
                    </span>
                  </td>
                  {canManage && (
                    <td className="actions">
                      <button
                        className="icon-btn"
                        aria-label="Editar"
                        onClick={() =>
                          open({
                            id: p.id,
                            carrera_id: p.carrera_id,
                            anio: p.anio.toString(),
                            malla_id: p.malla_id,
                            anios_gracia: p.anios_gracia.toString(),
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Eliminar"
                        onClick={() => void remove(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {promociones.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Aún no hay promociones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {draft && (
        <Modal
          title={draft.id ? "Editar promoción" : "Nueva promoción"}
          onClose={() => setDraft(null)}
          onSubmit={save}
          error={formError}
        >
          <label>
            Carrera
            <select
              value={draft.carrera_id}
              // Al cambiar de carrera se descarta la malla elegida: pertenecía a la anterior.
              onChange={(e) => setDraft({ ...draft, carrera_id: e.target.value, malla_id: "" })}
              disabled={!!draft.id}
              required
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {carreras.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="row-2">
            <label>
              Año de ingreso
              <input
                type="number"
                min={1900}
                max={2200}
                value={draft.anio}
                onChange={(e) => setDraft({ ...draft, anio: e.target.value })}
                disabled={!!draft.id}
                required
              />
            </label>
            <label>
              Años de gracia
              <input
                type="number"
                min={0}
                max={20}
                value={draft.anios_gracia}
                onChange={(e) => setDraft({ ...draft, anios_gracia: e.target.value })}
                required
              />
            </label>
          </div>
          <label>
            Malla (solo publicadas)
            <select
              value={draft.malla_id}
              onChange={(e) => setDraft({ ...draft, malla_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {mallasDe(draft.carrera_id).map((m) => (
                <option key={m.id} value={m.id}>
                  v{m.version} · {m.nombre}
                </option>
              ))}
            </select>
          </label>
          {draft.carrera_id && mallasDe(draft.carrera_id).length === 0 && (
            <p className="notice">Esa carrera no tiene mallas publicadas.</p>
          )}
        </Modal>
      )}
    </>
  );
}
