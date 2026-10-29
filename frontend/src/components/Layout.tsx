import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { home, sections } from "../modules";

export default function Layout() {
  const { me, can, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn"
            aria-label="Mostrar u ocultar menú"
            onClick={() => {
              if (window.matchMedia("(max-width: 800px)").matches) setMobileOpen((v) => !v);
              else setCollapsed((v) => !v);
            }}
          >
            <Menu size={20} />
          </button>
          <div className="spacer" />
          <span className="user-name">{fullName}</span>
          <span className="avatar" title={me?.roles.join(", ")}>
            {initials}
          </span>
          <button className="icon-btn" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={signOut}>
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
