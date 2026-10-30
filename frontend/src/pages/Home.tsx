/** Página de inicio: saludo y un tile por cada sección a la que el usuario tiene acceso. */
import { useAuth } from "../auth/AuthContext";
import TileGrid from "../components/TileGrid";
import { sections } from "../modules";

export default function Home() {
  const { can, me } = useAuth();
  const tiles = sections.filter((s) => s.tiles.some((t) => can(t.permiso)));
  return (
    <>
      <h1>Bienvenido{me?.nombre ? `, ${me.nombre}` : ""}</h1>
      {/* Un usuario recién creado no tiene roles hasta que un administrador se los asigna */}
      {me && me.roles.length === 0 && (
        <p className="notice">
          Tu usuario aún no tiene roles asignados. Pide a un administrador que te asigne uno.
        </p>
      )}
      <TileGrid tiles={tiles} />
    </>
  );
}
