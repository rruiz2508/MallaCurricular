import { ArrowLeft, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { estadoMallaBadge } from "../lib/types";
import type { Malla, MallaAsignatura, MallaDetalle } from "../lib/types";
import { useLoad } from "../lib/useLoad";

const numero = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 });

function sumar(filas: MallaAsignatura[]) {
  return filas.reduce(
    (suma, a) => ({
      horas: suma.horas + a.horas,
      teoricos: suma.teoricos + a.creditos_teoricos,
      practicos: suma.practicos + a.creditos_practicos,
    }),
    { horas: 0, teoricos: 0, practicos: 0 },
  );
}

function TablaSemestre({ semestre, filas }: { semestre: number | null; filas: MallaAsignatura[] }) {
  const total = sumar(filas);

  return (
    <div className="card table-card">
      <table className="reporte-malla-tabla">
        <caption>{semestre === null ? "Asignaturas sin semestre" : `Semestre ${semestre}`}</caption>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Asignatura</th>
            <th scope="col">Horas</th>
            <th scope="col">Créd. teóricos</th>
            <th scope="col">Créd. prácticos</th>
            <th scope="col">Prerrequisitos</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((a) => (
            <tr key={a.asignatura_id}>
              <td className="mono">{a.codigo}</td>
              <td>{a.nombre}</td>
              <td>{numero.format(a.horas)}</td>
              <td>{numero.format(a.creditos_teoricos)}</td>
              <td>{numero.format(a.creditos_practicos)}</td>
              <td>{a.prerrequisitos.map((r) => r.codigo).join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>Subtotal</th>
            <td>{numero.format(total.horas)}</td>
            <td>{numero.format(total.teoricos)}</td>
            <td>{numero.format(total.practicos)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PlanDeEstudios({ malla }: { malla: MallaDetalle }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(false);
  const total = sumar(malla.asignaturas);
  const porSemestre = new Map<number | null, MallaAsignatura[]>();
  for (const asignatura of malla.asignaturas) {
    const filas = porSemestre.get(asignatura.semestre) ?? [];
    filas.push(asignatura);
    porSemestre.set(asignatura.semestre, filas);
  }
  const semestres = [...porSemestre.keys()].sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
  const estado = estadoMallaBadge[malla.estado];

  async function descargar() {
    setError(false);
    setGenerando(true);
    try {
      const { descargarPdfMalla } = await import("../lib/mallaPdf");
      descargarPdfMalla(malla);
    } catch {
      setError(true);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{malla.nombre}</h2>
          <p className="muted">
            {malla.carrera_codigo} · {malla.carrera} · Versión {malla.version}{" "}
            <span className={`badge ${estado.clase}`}>{estado.texto}</span>
            {malla.resolucion && ` · Resolución ${malla.resolucion}`}
          </p>
        </div>
        <button type="button" className="btn" disabled={generando} onClick={() => void descargar()}>
          <Download size={16} aria-hidden="true" /> {generando ? "Generando PDF…" : "Descargar PDF"}
        </button>
      </div>
      {error && <p className="error" role="alert">No se pudo generar el PDF. Volvé a intentar.</p>}
      <ul className="stats" aria-label="Totales del plan">
        <li><strong>{malla.asignaturas.length}</strong> asignaturas</li>
        <li><strong>{numero.format(total.horas)}</strong> horas</li>
        <li><strong>{numero.format(total.teoricos)}</strong> créditos teóricos</li>
        <li><strong>{numero.format(total.practicos)}</strong> créditos prácticos</li>
        <li><strong>{numero.format(total.teoricos + total.practicos)}</strong> créditos totales</li>
      </ul>
      {semestres.length === 0 ? (
        <p className="muted">Esta versión todavía no tiene asignaturas.</p>
      ) : (
        <div className="reporte-malla-semestres">
          {semestres.map((semestre) => (
            <TablaSemestre key={semestre ?? "sin-semestre"} semestre={semestre} filas={porSemestre.get(semestre)!} />
          ))}
        </div>
      )}
    </>
  );
}

function ConsultaMalla() {
  const mallas = useLoad<Malla>("/mallas");
  const [carreraId, setCarreraId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [consulta, setConsulta] = useState<{ id: string; detalle?: MallaDetalle; error?: string }>();

  // La lista de mallas incluye la carrera. La consulta solo requiere el permiso mallas.leer.
  const carreras = useMemo(() => {
    const porId = new Map(mallas.data.map((m) => [m.carrera_id, { id: m.carrera_id, codigo: m.carrera_codigo, nombre: m.carrera }]));
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [mallas.data]);
  const versiones = mallas.data
    .filter((m) => m.carrera_id === carreraId)
    .sort((a, b) => b.version - a.version);
  const publicada = versiones.find((m) => m.estado === "publicada");
  const elegida = versiones.some((m) => m.id === versionId) ? versionId : (publicada?.id ?? "");
  const resultado = consulta?.id === elegida ? consulta : undefined;

  useEffect(() => {
    if (!elegida) return;
    const abort = new AbortController();
    api<MallaDetalle>(`/mallas/${elegida}`, { signal: abort.signal })
      .then((detalle) => {
        if (!abort.signal.aborted) setConsulta({ id: elegida, detalle });
      })
      .catch((error: Error) => {
        if (!abort.signal.aborted) setConsulta({ id: elegida, error: error.message });
      });
    return () => abort.abort();
  }, [elegida]);

  if (mallas.loading) return <p className="muted" role="status">Cargando carreras…</p>;
  if (mallas.error) return <p className="error" role="alert">{mallas.error}</p>;
  if (!carreras.length) return <p className="muted">Todavía no hay carreras con mallas registradas.</p>;

  return (
    <>
      <div className="toolbar">
        <label className="reporte-malla-filtro">
          Carrera
          <select value={carreraId} onChange={(e) => {
            setCarreraId(e.target.value);
            setVersionId("");
            setConsulta(undefined);
          }}>
            <option value="">Seleccioná una carrera</option>
            {carreras.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </label>
        <label className="reporte-malla-filtro">
          Versión
          <select value={elegida} disabled={!carreraId} onChange={(e) => {
            setVersionId(e.target.value);
            setConsulta(undefined);
          }}>
            {!publicada && <option value="">Seleccioná una versión</option>}
            {versiones.map((m) => (
              <option key={m.id} value={m.id}>
                v{m.version} · {estadoMallaBadge[m.estado].texto} · {m.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {carreraId && !elegida && <p className="muted">Esta carrera no tiene una malla publicada. Podés consultar otra versión.</p>}
      {elegida && !resultado && <p className="muted" role="status">Cargando plan de estudios…</p>}
      {resultado?.error && <p className="error" role="alert">{resultado.error}</p>}
      {resultado?.detalle && <PlanDeEstudios key={elegida} malla={resultado.detalle} />}
    </>
  );
}

export default function ReporteMalla() {
  const { can } = useAuth();

  return (
    <>
      <Link className="back-link" to="/reportes"><ArrowLeft size={14} /> Reportes</Link>
      <div className="page-head"><h1>Malla por carrera</h1></div>
      {can("mallas.leer") ? <ConsultaMalla /> : <p className="error">No tenés permiso para consultar mallas curriculares.</p>}
    </>
  );
}
