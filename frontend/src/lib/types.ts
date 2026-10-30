/** Tipos de los datos que devuelve la API, compartidos por varias pantallas. */

export type EstadoMalla = "borrador" | "publicada" | "archivada";
export type TipoMateria = "obligatoria" | "electiva" | "complementaria" | "trabajo_final";

export interface Malla {
  id: string;
  carrera_id: string;
  carrera_codigo: string;
  carrera: string;
  version: number;
  nombre: string;
  resolucion: string | null;
  duracion_semestres: number;
  horas_por_credito: number;
  estado: EstadoMalla;
  publicada_at: string | null;
  archivada_at: string | null;
  cantidad_asignaturas: number;
  cantidad_promociones: number;
}

export interface Relacion {
  id: string;
  relacionada_id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

export interface MallaAsignatura {
  asignatura_id: string;
  codigo: string;
  codigo_sistema: string | null;
  nombre: string;
  semestre: number | null;
  tipo: TipoMateria;
  orden: number | null;
  horas: number;
  creditos_teoricos: number;
  creditos_practicos: number;
  prerrequisitos: Relacion[];
}

export interface MallaDetalle extends Malla {
  asignaturas: MallaAsignatura[];
}

/** Estilo de la insignia de cada estado de una malla. */
export const estadoMallaBadge: Record<EstadoMalla, { clase: string; texto: string }> = {
  borrador: { clase: "warn", texto: "Borrador" },
  publicada: { clase: "ok", texto: "Publicada" },
  archivada: { clase: "off", texto: "Archivada" },
};
