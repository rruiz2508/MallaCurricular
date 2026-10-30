/**
 * Detalle de una malla curricular: la malla armada por semestres.
 *
 * Mientras es borrador se puede editar (agregar, mover y quitar materias, y definir sus
 * prerrequisitos). Una malla publicada o archivada es de solo lectura: para cambiarla se
 * crea una nueva versión (copia en borrador). Las reglas de consistencia (un prerrequisito
 * debe estar en un semestre anterior, el semestre no puede superar la duración, etc.) las
 * aplica el backend; aquí solo se ofrecen opciones válidas y se muestran sus mensajes.
 */
import { ArrowLeft, Archive, Copy, Pencil, Plus, Rocket, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import Modal from "../components/Modal";
import { api } from "../lib/api";
import { estadoMallaBadge } from "../lib/types";
import type { MallaAsignatura, MallaDetalle as Detalle, TipoMateria } from "../lib/types";
import { useLoad } from "../lib/useLoad";

interface Asignatura {
  id: string;
  codigo: string;
  nombre: string;
  estado: string;
}

/** Formulario de una materia dentro de la malla. Con `editando` se modifica una existente. */
interface MateriaDraft {
  editando?: string;
  asignatura_id: string;
  tipo: TipoMateria;
  semestre: string;
  /** ids de las asignaturas que debe tener aprobadas antes. */
  prerrequisitos: string[];
}

interface DatosDraft {
  nombre: string;
  resolucion: string;
  duracion_semestres: string;
  horas_por_credito: string;
}

const tipos: Record<TipoMateria, string> = {
  obligatoria: "Obligatoria",
  electiva: "Electiva",
  complementaria: "Actividad complementaria",
  trabajo_final: "Trabajo final",
};

/** Las actividades complementarias y el trabajo final no se cursan en un semestre. */
const sinSemestre = (tipo: TipoMateria) => tipo === "complementaria" || tipo === "trabajo_final";

/** 4 -> "4"; 2.5 -> "2.5" (los créditos casi siempre son enteros). */
const fmt = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

export default function MallaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const catalogo = useLoad<Asignatura>("/asignaturas", { optional: true });
  const [malla, setMalla] = useState<Detalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materia, setMateria] = useState<MateriaDraft | null>(null);
  const [datos, setDatos] = useState<DatosDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setMalla(await api<Detalle>(`/mallas/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void cargar();
  }, [cargar]);

  const editable = malla?.estado === "borrador" && can("mallas.gestionar");

  const totales = useMemo(() => {
    const filas = malla?.asignaturas ?? [];
    return {
      teoricos: filas.reduce((s, a) => s + a.creditos_teoricos, 0),
      practicos: filas.reduce((s, a) => s + a.creditos_practicos, 0),
      horas: filas.reduce((s, a) => s + a.horas, 0),
    };
  }, [malla]);

  if (loading) return <p className="muted">Cargando…</p>;
  if (!malla) {
    return (
      <>
        <Link className="back-link" to="/academico/mallas">
          <ArrowLeft size={14} /> Mallas
        </Link>
        <p className="error">{error ?? "No se pudo cargar la malla"}</p>
      </>
    );
  }

  const badge = estadoMallaBadge[malla.estado];
  const semestres = Array.from({ length: malla.duracion_semestres }, (_, i) => i + 1);
  const enMalla = new Set(malla.asignaturas.map((a) => a.asignatura_id));

  /** Ejecuta una acción sobre la malla que devuelve su detalle actualizado. */
  async function accion(path: string, init: RequestInit, confirmacion?: string) {
    if (confirmacion && !window.confirm(confirmacion)) return;
    try {
      setMalla(await api<Detalle>(`/mallas/${malla!.id}${path}`, init));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function clonar() {
    if (!malla || !window.confirm("¿Crear una nueva versión (borrador) copiando esta malla?"))
      return;
    try {
      const nueva = await api<Detalle>(`/mallas/${malla.id}/clonar`, { method: "POST" });
      navigate(`/academico/mallas/${nueva.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function abrirMateria(next: MateriaDraft) {
    setFormError(null);
    setMateria(next);
  }

  /** Materias que pueden ser prerrequisito: las de un semestre anterior al elegido. */
  function candidatos(d: MateriaDraft): MallaAsignatura[] {
    const limite = sinSemestre(d.tipo) ? Infinity : Number(d.semestre);
    return malla!.asignaturas.filter(
      (a) => a.asignatura_id !== d.asignatura_id && a.semestre !== null && a.semestre < limite,
    );
  }

  /**
   * Guarda la materia. Son varias llamadas (cada una es atómica por sí sola), en un orden
   * que evita estados intermedios inválidos: primero se quitan los prerrequisitos que
   * sobran, luego se mueve la materia y al final se agregan los nuevos.
   */
  async function guardarMateria(event: FormEvent) {
    event.preventDefault();
    if (!materia || !malla) return;
    setFormError(null);
    const semestre = sinSemestre(materia.tipo) ? null : Number(materia.semestre);
    const validos = new Set(
      candidatos(materia)
        .map((a) => a.asignatura_id)
        .filter((i) => materia.prerrequisitos.includes(i)),
    );
    const base = `/mallas/${malla.id}`;
    try {
      let actual = malla;
      let conservados = new Set<string>();
      if (materia.editando) {
        const previa = malla.asignaturas.find((a) => a.asignatura_id === materia.editando)!;
        for (const rel of previa.prerrequisitos) {
          if (validos.has(rel.relacionada_id)) conservados.add(rel.relacionada_id);
          else actual = await api<Detalle>(`${base}/relaciones/${rel.id}`, { method: "DELETE" });
        }
        if (previa.semestre !== semestre || previa.tipo !== materia.tipo) {
          actual = await api<Detalle>(`${base}/asignaturas/${materia.editando}`, {
            method: "PATCH",
            body: JSON.stringify({ semestre, tipo: materia.tipo }),
          });
        }
      } else {
        actual = await api<Detalle>(`${base}/asignaturas`, {
          method: "POST",
          body: JSON.stringify({ asignatura_id: materia.asignatura_id, semestre, tipo: materia.tipo }),
        });
        conservados = new Set();
      }
      for (const requerida of validos) {
        if (conservados.has(requerida)) continue;
        actual = await api<Detalle>(`${base}/relaciones`, {
          method: "POST",
          body: JSON.stringify({ asignatura_id: materia.asignatura_id, relacionada_id: requerida }),
        });
      }
      setMalla(actual);
      setMateria(null);
    } catch (e) {
      setFormError((e as Error).message);
      // Los pasos ya aplicados quedaron guardados: se recarga para no mostrar datos viejos.
      await cargar();
    }
  }

  async function guardarDatos(event: FormEvent) {
    event.preventDefault();
    if (!datos) return;
    setFormError(null);
    try {
      setMalla(
        await api<Detalle>(`/mallas/${malla!.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            nombre: datos.nombre,
            resolucion: datos.resolucion.trim() || null,
            duracion_semestres: Number(datos.duracion_semestres),
            horas_por_credito: Number(datos.horas_por_credito),
          }),
        }),
      );
      setDatos(null);
    } catch (e) {
      setFormError((e as Error).message);
    }
  }

  /** Tarjeta de una materia dentro de un semestre. */
  const tarjeta = (a: MallaAsignatura) => (
    <div className="materia" key={a.asignatura_id}>
      <div className="materia-head">
        <span className="materia-code mono">{a.codigo}</span>
        {editable && (
          <span>
            <button
              className="icon-btn"
              aria-label="Editar"
              onClick={() =>
                abrirMateria({
                  editando: a.asignatura_id,
                  asignatura_id: a.asignatura_id,
                  tipo: a.tipo,
                  semestre: a.semestre?.toString() ?? "",
                  prerrequisitos: a.prerrequisitos.map((r) => r.relacionada_id),
                })
              }
            >
              <Pencil size={14} />
            </button>
            <button
              className="icon-btn"
              aria-label="Quitar de la malla"
              onClick={() =>
                void accion(
                  `/asignaturas/${a.asignatura_id}`,
                  { method: "DELETE" },
                  `¿Quitar "${a.codigo}" de la malla? También se quitan sus prerrequisitos.`,
                )
              }
            >
              <Trash2 size={14} />
            </button>
          </span>
        )}
      </div>
      <span>{a.nombre}</span>
      <span className="materia-meta">
        {a.horas} h · {fmt(a.creditos_teoricos)}T / {fmt(a.creditos_practicos)}P cr.
      </span>
      <div className="chips">
        {a.tipo !== "obligatoria" && <span className="badge off">{tipos[a.tipo]}</span>}
        {a.prerrequisitos.map((r) => (
          <span key={r.id} className="chip" title={r.nombre}>
            req. {r.codigo}
          </span>
        ))}
      </div>
    </div>
  );

  const complementarias = malla.asignaturas.filter((a) => a.semestre === null);

  return (
    <>
      <Link className="back-link" to="/academico/mallas">
        <ArrowLeft size={14} /> Mallas curriculares
      </Link>
      <div className="page-head">
        <div>
          <h1>
            {malla.nombre} <span className="muted">v{malla.version}</span>{" "}
            <span className={`badge ${badge.clase}`}>{badge.texto}</span>
          </h1>
          <span className="muted">
            {malla.carrera_codigo} · {malla.carrera}
            {malla.resolucion ? ` · ${malla.resolucion}` : ""}
          </span>
        </div>
        <div className="inline-actions">
          {editable && (
            <button
              className="btn"
              onClick={() => {
                setFormError(null);
                setDatos({
                  nombre: malla.nombre,
                  resolucion: malla.resolucion ?? "",
                  duracion_semestres: malla.duracion_semestres.toString(),
                  horas_por_credito: malla.horas_por_credito.toString(),
                });
              }}
            >
              <Pencil size={16} /> Datos
            </button>
          )}
          {can("mallas.gestionar") && (
            <button className="btn" onClick={() => void clonar()}>
              <Copy size={16} /> Nueva versión
            </button>
          )}
          {malla.estado === "borrador" && can("mallas.publicar") && (
            <button
              className="btn primary"
              onClick={() =>
                void accion(
                  "/publicar",
                  { method: "POST" },
                  "Una vez publicada, la malla ya no se podrá modificar (solo crear una nueva versión). ¿Publicar?",
                )
              }
            >
              <Rocket size={16} /> Publicar
            </button>
          )}
          {malla.estado === "publicada" && can("mallas.publicar") && (
            <button
              className="btn"
              onClick={() =>
                void accion("/archivar", { method: "POST" }, "¿Archivar esta malla? Quedará como historial.")
              }
            >
              <Archive size={16} /> Archivar
            </button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {malla.estado !== "borrador" && (
        <p className="notice" style={{ marginBottom: "1rem" }}>
          Esta malla está {malla.estado} y no se puede modificar. Para hacer cambios cree una
          nueva versión.
        </p>
      )}

      <ul className="stats">
        <li>
          <strong>{malla.asignaturas.length}</strong> asignaturas
        </li>
        <li>
          <strong>{fmt(totales.teoricos)}</strong> créditos teóricos
        </li>
        <li>
          <strong>{fmt(totales.practicos)}</strong> créditos prácticos
        </li>
        <li>
          <strong>{totales.horas}</strong> horas
        </li>
        <li>
          <strong>{malla.cantidad_promociones}</strong> promociones
        </li>
      </ul>

      <div className="malla-grid">
        {semestres.map((n) => (
          <section className="semestre" key={n}>
            <div className="semestre-head">
              <span>Semestre {n}</span>
              {editable && (
                <button
                  className="icon-btn"
                  aria-label={`Agregar al semestre ${n}`}
                  onClick={() =>
                    abrirMateria({
                      asignatura_id: "",
                      tipo: "obligatoria",
                      semestre: n.toString(),
                      prerrequisitos: [],
                    })
                  }
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            {malla.asignaturas.filter((a) => a.semestre === n).map(tarjeta)}
          </section>
        ))}
      </div>

      {(complementarias.length > 0 || editable) && (
        <>
          <h2 style={{ marginTop: "1.5rem" }}>Sin semestre</h2>
          <div className="malla-grid">
            <section className="semestre">
              <div className="semestre-head">
                <span>Complementarias y trabajo final</span>
                {editable && (
                  <button
                    className="icon-btn"
                    aria-label="Agregar actividad sin semestre"
                    onClick={() =>
                      abrirMateria({
                        asignatura_id: "",
                        tipo: "complementaria",
                        semestre: "",
                        prerrequisitos: [],
                      })
                    }
                  >
                    <Plus size={16} />
                  </button>
                )}
              </div>
              {complementarias.map(tarjeta)}
            </section>
          </div>
        </>
      )}

      {materia && (
        <Modal
          title={materia.editando ? "Editar materia en la malla" : "Agregar materia a la malla"}
          onClose={() => setMateria(null)}
          onSubmit={guardarMateria}
          error={formError}
          wide
        >
          <label>
            Asignatura
            <select
              value={materia.asignatura_id}
              onChange={(e) => setMateria({ ...materia, asignatura_id: e.target.value })}
              disabled={!!materia.editando}
              required
            >
              <option value="" disabled>
                Seleccione…
              </option>
              {catalogo.data
                .filter(
                  (a) =>
                    a.id === materia.asignatura_id || (!enMalla.has(a.id) && a.estado !== "inactiva"),
                )
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} · {a.nombre}
                  </option>
                ))}
            </select>
          </label>
          <div className="row-2">
            <label>
              Tipo
              <select
                value={materia.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoMateria;
                  setMateria({
                    ...materia,
                    tipo,
                    // Las materias sin semestre pasan a tenerlo (y al revés) con el tipo.
                    semestre: sinSemestre(tipo) ? "" : materia.semestre || "1",
                  });
                }}
              >
                {Object.entries(tipos).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Semestre
              <select
                value={materia.semestre}
                onChange={(e) => setMateria({ ...materia, semestre: e.target.value })}
                disabled={sinSemestre(materia.tipo)}
                required={!sinSemestre(materia.tipo)}
              >
                {sinSemestre(materia.tipo) && <option value="">Sin semestre</option>}
                {semestres.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Prerrequisitos (materias de semestres anteriores)
          </label>
          <div className="check-list">
            {candidatos(materia).length === 0 && (
              <p className="muted">No hay materias de semestres anteriores.</p>
            )}
            {candidatos(materia).map((a) => (
              <label key={a.asignatura_id} className="check">
                <input
                  type="checkbox"
                  checked={materia.prerrequisitos.includes(a.asignatura_id)}
                  onChange={(e) =>
                    setMateria({
                      ...materia,
                      prerrequisitos: e.target.checked
                        ? [...materia.prerrequisitos, a.asignatura_id]
                        : materia.prerrequisitos.filter((i) => i !== a.asignatura_id),
                    })
                  }
                />
                <span className="mono">{a.codigo}</span> · {a.nombre}{" "}
                <span className="muted">(sem. {a.semestre})</span>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {datos && (
        <Modal
          title="Datos de la malla"
          onClose={() => setDatos(null)}
          onSubmit={guardarDatos}
          error={formError}
        >
          <label>
            Nombre
            <input
              value={datos.nombre}
              onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
              required
            />
          </label>
          <label>
            Resolución
            <input
              value={datos.resolucion}
              onChange={(e) => setDatos({ ...datos, resolucion: e.target.value })}
            />
          </label>
          <div className="row-2">
            <label>
              Duración (semestres)
              <input
                type="number"
                min={1}
                max={20}
                value={datos.duracion_semestres}
                onChange={(e) => setDatos({ ...datos, duracion_semestres: e.target.value })}
                required
              />
            </label>
            <label>
              Horas por crédito
              <input
                type="number"
                min={1}
                max={100}
                value={datos.horas_por_credito}
                onChange={(e) => setDatos({ ...datos, horas_por_credito: e.target.value })}
                required
              />
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
