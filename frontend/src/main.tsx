/**
 * Punto de entrada del frontend.
 *
 * Los proveedores se anidan de afuera hacia adentro:
 *  - BrowserRouter: habilita la navegación por rutas (react-router).
 *  - AuthProvider: mantiene la sesión de Supabase y el perfil/permisos del usuario,
 *    disponibles para toda la aplicación mediante `useAuth()`.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
