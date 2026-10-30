/**
 * Cuadrícula de tarjetas de acceso a los módulos: ícono en un contenedor tenue, nombre,
 * descripción corta y una flecha. Recibe ya filtrados los tiles que el usuario puede ver.
 */
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export interface TileItem {
  path: string;
  label: string;
  descripcion?: string;
  icon: LucideIcon;
}

export default function TileGrid({ tiles }: { tiles: TileItem[] }) {
  if (tiles.length === 0) {
    return <p className="muted">No tienes permisos para ver módulos en esta sección.</p>;
  }
  return (
    <div className="tile-grid">
      {tiles.map((t) => (
        <Link key={t.path} to={t.path} className="tile">
          <span className="tile-icon">
            <t.icon size={22} strokeWidth={1.8} />
          </span>
          <span className="tile-body">
            <span className="tile-title">{t.label}</span>
            {t.descripcion && <span className="tile-desc">{t.descripcion}</span>}
          </span>
          <ArrowRight className="tile-arrow" size={16} />
        </Link>
      ))}
    </div>
  );
}
