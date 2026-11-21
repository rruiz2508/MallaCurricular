/**
 * Reporte "Vigencia de promociones": para cada promoción de ingreso, qué malla le aplica y
 * hasta qué año está vigente. Es de solo lectura; los datos salen de `GET /promociones`
 * (la vigencia la calcula la base: ingreso + duración de la malla + años de gracia).
 */
import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Paginacion from "../components/Paginacion";
import { useLoad } from "../lib/useLoad";
import { usePaginacion } from "../lib/usePaginacion";

interface Promocion {
  id: string;
  carrera_id: string;
  carrera_codigo: string;
  carrera: string;
  anio: number;
  malla_version: number;
  malla_nombre: string;
  anios_gracia: number;
  anio_fin_regular: number;
  anio_fin_vigencia: number;
  vigente: boolean;
}

function Consulta() {
  const promociones = useLoad<Promocion>("/promociones");
  const [carreraId, setCarreraId] = useState("");
  const [soloVigentes, setSoloVigentes] = useState(false);

  const carreras = useMemo(() => {
    const porId = new Map(
      promociones.data.map((p) => [
        p.carrera_id,
        { id: p.carrera_id, codigo: p.carrera_codigo, nombre: p.carrera },
      ]),
    );
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [promociones.data]);

  const filtradas = useMemo(
    () =>
      promociones.data
        .filter((p) => !carreraId || p.carrera_id === carreraId)
        .filter((p) => !soloVigentes || p.vigente)
        .sort(
          (a, b) => a.carrera.localeCompare(b.carrera, "es") || b.anio - a.anio,
        ),
    [promociones.data, carreraId, soloVigentes],
  );
  const paginacion = usePaginacion(filtradas);
  const anioActual = new Date().getFullYear();

  if (promociones.loading) return <p className="muted">Cargando…</p>;
  if (promociones.error) return <p className="error">{promociones.error}</p>;

  return (
    <>
      <div className="toolbar">
        <label className="reporte-malla-filtro">
          Carrera
          <select value={carreraId} onChange={(e) => setCarreraId(e.target.value)}>
            <option value="">Todas las carreras</option>
            {carreras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.codigo} · {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={soloVigentes}
            onChange={(e) => setSoloVigentes(e.target.checked)}
          />
          Solo vigentes
        </label>
      </div>
      <p className="muted">
        {filtradas.length} promoción(es) · {filtradas.filter((p) => p.vigente).length} vigente(s)
      </p>
      <div className="card table-card">
        <table>
          <thead>
            <tr>
              <th>Carrera</th>
              <th>Promoción</th>
              <th>Malla aplicable</th>
              <th>Fin regular</th>
              <th>Años de gracia</th>
              <th>Vigente hasta</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {paginacion.filas.map((p) => (
              <tr key={p.id}>
                <td>
                  <span className="mono">{p.carrera_codigo}</span>{" "}
                  <span className="muted">{p.carrera}</span>
                </td>
                <td>{p.anio}</td>
                <td>
                  v{p.malla_version} · {p.malla_nombre}
                </td>
                <td>{p.anio_fin_regular}</td>
                <td>{p.anios_gracia}</td>
                <td>{p.anio_fin_vigencia}</td>
                <td>
                  <span className={`badge ${p.vigente ? "ok" : "off"}`}>
                    {p.vigente
                      ? `Vigente (${Math.max(p.anio_fin_vigencia - anioActual, 0)} año(s) restantes)`
                      : "Vencida"}
                  </span>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No hay promociones que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Paginacion datos={paginacion} />
      </div>
    </>
  );
}

export default function ReporteVigencia() {
  const { can } = useAuth();
  return (
    <>
      <Link className="back-link" to="/reportes">
        <ArrowLeft size={14} /> Reportes
      </Link>
      <div className="page-head">
        <h1>Vigencia de promociones</h1>
      </div>
      {can("promociones.leer") ? (
        <Consulta />
      ) : (
        <p className="error">No tenés permiso para consultar promociones.</p>
      )}
    </>
  );
}
