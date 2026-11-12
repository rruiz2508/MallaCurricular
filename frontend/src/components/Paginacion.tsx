import { tamanosPagina } from "../lib/usePaginacion";
import type { usePaginacion } from "../lib/usePaginacion";

type Props = { datos: ReturnType<typeof usePaginacion> };

export default function Paginacion({ datos }: Props) {
  if (datos.total <= tamanosPagina[0]) return null;

  return (
    <nav className="paginacion" aria-label="Paginación del listado">
      <span className="muted" role="status">
        {datos.primero}–{datos.fin} de {datos.total} · Página {datos.pagina} de {datos.paginas}
      </span>
      <div className="paginacion-controles">
        <label>
          Filas por página{" "}
          <select value={datos.tamano} onChange={(evento) => datos.cambiarTamano(Number(evento.target.value))}>
            {tamanosPagina.map((tamano) => <option key={tamano} value={tamano}>{tamano}</option>)}
          </select>
        </label>
        <button type="button" className="btn" disabled={datos.pagina === 1} onClick={datos.anterior}>
          Anterior
        </button>
        <button type="button" className="btn" disabled={datos.pagina === datos.paginas} onClick={datos.siguiente}>
          Siguiente
        </button>
      </div>
    </nav>
  );
}
