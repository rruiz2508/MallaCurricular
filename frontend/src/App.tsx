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
  const { loading, session, me, meError } = useAuth();

  if (loading) return <div className="center-screen">Cargando…</div>;
  if (!session) return <Login />;
  if (!me) {
    return (
      <div className="center-screen">
        <div className="card">
          <h2>No se pudo cargar tu perfil</h2>
          <p className="muted">{meError ?? "Error desconocido"}</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        {sections.map((s) => (
          <Route key={s.path} path={s.path} element={<SectionPage section={s} />} />
        ))}
        <Route path="/academico/facultades" element={<Facultades />} />
        {sections
          .flatMap((s) => s.tiles)
          .filter((t) => !t.implemented)
          .map((t) => (
            <Route key={t.path} path={t.path} element={<Placeholder title={t.label} />} />
          ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
