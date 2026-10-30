/**
 * Ventana modal con formulario: título, contenido, mensaje de error y botones
 * Cancelar / Guardar. Hacer clic en el fondo la cierra; el clic dentro del formulario no
 * se propaga para no cerrarla por accidente.
 */
import type { FormEvent, ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  /** Error del último intento de guardado (p. ej. "Ya existe una carrera con ese código"). */
  error?: string | null;
  /** Modal más ancho, para formularios con muchos campos. */
  wide?: boolean;
  submitLabel?: string;
  children: ReactNode;
}

export default function Modal({
  title,
  onClose,
  onSubmit,
  error,
  wide,
  submitLabel = "Guardar",
  children,
}: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className={`card modal${wide ? " wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2>{title}</h2>
        {children}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}
