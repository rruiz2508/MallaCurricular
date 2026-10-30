/**
 * Estructura común de todas las pantallas autenticadas: menú lateral a la izquierda y
 * cabecera con el selector de tema y el usuario arriba. El contenido de cada página se dibuja
 * en el `<Outlet />` (lo decide la ruta activa).
 */
import { LogOut, Menu, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../lib/theme";
import { home, sections } from "../modules";

export default function Layout() {
  const { me, can, signOut } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  // En pantallas anchas el menú se contrae a solo íconos; en móviles se abre como
  // panel superpuesto. Son dos estados separados porque se comportan distinto.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Solo se listan las secciones donde el usuario puede ver al menos un módulo.
  const visibleSections = sections.filter((s) => s.tiles.some((t) => can(t.permiso)));
  const items = [home, ...visibleSections];
  const initials = `${me?.nombre?.[0] ?? ""}${me?.apellido?.[0] ?? ""}`.toUpperCase() || "U";
  const fullName = `${me?.nombre ?? ""} ${me?.apellido ?? ""}`.trim() || me?.email || "Usuario";

  return (
    <div className={`shell${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">MC</span>
          <span className="brand-text">Malla Curricular</span>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              // `end` en Inicio: evita que "/" se marque activo en todas las rutas.
              end={item.path === "/"}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {/* Fondo oscuro que cierra el menú móvil al tocarlo */}
      {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            aria-label="Mostrar u ocultar menú"
            onClick={() => {
              // El mismo botón contrae el menú en escritorio y lo abre en móvil. El
              // umbral (800px) debe coincidir con el media query de index.css.
              if (window.matchMedia("(max-width: 800px)").matches) setMobileOpen((v) => !v);
              else setCollapsed((v) => !v);
            }}
          >
            <Menu size={20} />
          </button>
          <div className="spacer" />
          <button
            className="icon-btn"
            aria-label={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="user-name">{fullName}</span>
          {/* Al pasar el cursor sobre el avatar se ven los roles del usuario */}
          <span className="avatar" title={me?.roles.join(", ")}>
            {initials}
          </span>
          <button
            className="icon-btn"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={signOut}
          >
            <LogOut size={18} />
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
