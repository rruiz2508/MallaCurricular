/** Página de una sección (Académico, Seguridad, Reportes): muestra sus módulos permitidos. */
import { useAuth } from "../auth/AuthContext";
import TileGrid from "../components/TileGrid";
import type { Section } from "../modules";

export default function SectionPage({ section }: { section: Section }) {
  const { can } = useAuth();
  return (
    <>
      <h1>{section.label}</h1>
      <TileGrid tiles={section.tiles.filter((t) => can(t.permiso))} />
    </>
  );
}
