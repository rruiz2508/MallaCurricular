import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

export interface TileItem {
  path: string;
  label: string;
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
          <t.icon size={34} strokeWidth={1.6} />
          <span>{t.label}</span>
        </Link>
      ))}
    </div>
  );
}
