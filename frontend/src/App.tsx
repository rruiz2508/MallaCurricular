/**
 * Componente raíz: decide qué se muestra según el estado de la sesión y define las rutas.
 *
 * Estados, en orden:
 *  1. Cargando sesión/perfil  -> pantalla de espera.
 *  2. Sin sesión              -> formulario de login.
 *  3. Sesión pero sin perfil  -> mensaje de error (p. ej. el backend no responde).
 *  4. Sesión con perfil       -> la aplicación, dentro del Layout (menú + cabecera).
 */
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Facultades from "./pages/Facultades";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Placeholder from "./pages/Placeholder";
import SectionPage from "./pages/SectionPage";
import { sections } from "./modules";

export default function App() {
  const { loading, session, me, meError, refresh, signOut } = useAuth();

  if (loading) return <div className="center-screen">Cargando…</div>;
  if (!session) return <Login />;
  if (!me) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>No se pudo cargar tu perfil</h2>
          <p className="muted">{meError ?? "Error desconocido"}</p>
          {/* Sin estas acciones el usuario queda atrapado: la sesión sigue guardada
              en el navegador, así que no vería el login para volver a intentarlo. */}
          <div className="modal-actions">
            <button className="btn" onClick={signOut}>
              Cerrar sesión
            </button>
            <button className="btn primary" onClick={refresh}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Todas las rutas comparten el Layout; su contenido se dibuja en el <Outlet /> */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {/* Una página de tiles por sección (Académico, Seguridad, Reportes) */}
        {sections.map((s) => (
          <Route key={s.path} path={s.path} element={<SectionPage section={s} />} />
        ))}
        <Route path="/academico/facultades" element={<Facultades />} />
        {/* Los módulos aún no implementados comparten una página "en construcción".
            Al implementar uno, se marca `implemented: true` en modules.ts y se agrega
            su ruta explícita arriba. */}
        {sections
          .flatMap((s) => s.tiles)
          .filter((t) => !t.implemented)
          .map((t) => (
            <Route key={t.path} path={t.path} element={<Placeholder title={t.label} />} />
          ))}
        {/* Cualquier ruta desconocida vuelve al inicio */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
