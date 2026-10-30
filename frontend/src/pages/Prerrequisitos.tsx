/**
 * Vista de consulta de los prerrequisitos de una malla: qué materia exige cuáles.
 *
 * Se editan en el detalle de la malla (al agregar o editar cada materia); aquí se ven
 * todos juntos, de forma resumida, para revisar la cadena de correlatividades.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import { estadoMallaBadge } from "../lib/types";
import type { Malla, MallaDetalle } from "../lib/types";
import { useLoad } from "../lib/useLoad";

export default function Prerrequisitos() {
  const mallas = useLoad<Malla>("/mallas");
  const [mallaId, setMallaId] = useState("");
  const [detalle, setDetalle] = useState<MallaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Por defecto, la versión publicada más reciente (o la primera de la lista).
  useEffect(() => {
    if (mallaId || mallas.data.length === 0) return;
    setMallaId((mallas.data.find((m) => m.estado === "publicada") ?? mallas.data[0]).id);
  }, [mallas.data, mallaId]);

  useEffect(() => {
    if (!mallaId) return;
    let cancelled = false;
    api<MallaDetalle>(`/mallas/${mallaId}`)
      .then((d) => {
        if (cancelled) return;
        setDetalle(d);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mallaId]);

  const filas = detalle?.asignaturas ?? [];

  return (
    <>
      <div className="page-head">
        <h1>Prerrequisitos</h1>
      </div>

      <div className="toolbar">
        <select value={mallaId} onChange={(e) => setMallaId(e.target.value)}>
          {mallas.data.map((m) => (
            <option key={m.id} value={m.id}>
              {m.carrera_codigo} · v{m.version} · {m.nombre} ({estadoMallaBadge[m.estado].texto})
            </option>
          ))}
        </select>
        {detalle && <Link to={`/academico/mallas/${detalle.id}`}>Abrir la malla</Link>}
      </div>

      {(mallas.error || error) && <p className="error">{mallas.error ?? error}</p>}
      {mallas.loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Sem.</th>
                <th>Materia</th>
                <th>Requiere</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((a) => (
                <tr key={a.asignatura_id}>
                  <td>{a.semestre ?? "—"}</td>
                  <td>
                    <span className="mono">{a.codigo}</span> · {a.nombre}
                  </td>
                  <td>
                    {a.prerrequisitos.length === 0 ? (
                      <span className="muted">Ninguno</span>
                    ) : (
                      <div className="chips">
                        {a.prerrequisitos.map((r) => (
                          <span key={r.id} className="chip" title={r.nombre}>
                            {r.codigo}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    La malla no tiene asignaturas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
