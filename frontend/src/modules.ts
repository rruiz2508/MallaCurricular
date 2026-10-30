/**
 * Catálogo de módulos de la aplicación: de aquí salen el menú lateral y los tiles.
 *
 * Estructura: el menú tiene una entrada por sección; cada sección agrupa módulos
 * ("tiles"). Un tile solo se muestra si el usuario tiene su `permiso`, y una sección
 * solo aparece en el menú si el usuario puede ver al menos uno de sus tiles.
 *
 * Para agregar un módulo: añadir un tile aquí, crear su página y registrar su ruta en
 * App.tsx. Mientras no tenga página propia se muestra "en construcción".
 */
import {
  ArrowLeftRight,
  BookOpen,
  Building2,
  FileBarChart,
  GraduationCap,
  Home,
  Library,
  Network,
  ShieldCheck,
  ShieldHalf,
  Table2,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Un módulo accesible desde una sección. */
export interface Tile {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Permiso mínimo para verlo (el mismo que exige el backend para listar). */
  permiso: string;
  /** true si ya tiene página propia; si no, se usa la página "en construcción". */
  implemented?: boolean;
}

/** Un grupo de módulos, que aparece como entrada del menú lateral. */
export interface Section {
  path: string;
  label: string;
  icon: LucideIcon;
  tiles: Tile[];
}

/** Entrada fija "Inicio" del menú (no depende de permisos). */
export const home = { path: "/", label: "Inicio", icon: Home };

export const sections: Section[] = [
  {
    path: "/academico",
    label: "Académico",
    icon: GraduationCap,
    tiles: [
      {
        path: "/academico/facultades",
        label: "Facultades",
        icon: Building2,
        permiso: "facultades.leer",
        implemented: true,
      },
      { path: "/academico/carreras", label: "Carreras", icon: BookOpen, permiso: "carreras.leer" },
      {
        path: "/academico/asignaturas",
        label: "Asignaturas",
        icon: Library,
        permiso: "asignaturas.leer",
      },
      {
        path: "/academico/mallas",
        label: "Mallas curriculares",
        icon: Table2,
        permiso: "mallas.leer",
      },
      {
        path: "/academico/promociones",
        label: "Promociones",
        icon: Users,
        permiso: "promociones.leer",
      },
      {
        path: "/academico/equivalencias",
        label: "Equivalencias",
        icon: ArrowLeftRight,
        permiso: "asignaturas.leer",
      },
      {
        path: "/academico/correlatividades",
        label: "Prerrequisitos",
        icon: Network,
        permiso: "mallas.leer",
      },
    ],
  },
  {
    path: "/seguridad",
    label: "Seguridad",
    icon: ShieldCheck,
    tiles: [
      { path: "/seguridad/usuarios", label: "Usuarios", icon: UserCog, permiso: "usuarios.leer" },
      {
        path: "/seguridad/roles",
        label: "Roles y permisos",
        icon: ShieldHalf,
        permiso: "roles.leer",
      },
    ],
  },
  {
    path: "/reportes",
    label: "Reportes",
    icon: FileBarChart,
    tiles: [
      { path: "/reportes/malla", label: "Malla por carrera", icon: Table2, permiso: "mallas.leer" },
      {
        path: "/reportes/promociones",
        label: "Vigencia de promociones",
        icon: Users,
        permiso: "promociones.leer",
      },
    ],
  },
];
