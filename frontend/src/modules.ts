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
  /** Texto corto bajo el nombre en la tarjeta del módulo. */
  descripcion: string;
  /** Permiso mínimo para verlo (el mismo que exige el backend para listar). */
  permiso: string;
  /** true si ya tiene página propia; si no, se usa la página "en construcción". */
  implemented?: boolean;
}

/** Un grupo de módulos, que aparece como entrada del menú lateral. */
export interface Section {
  path: string;
  label: string;
  descripcion: string;
  icon: LucideIcon;
  tiles: Tile[];
}

/** Entrada fija "Inicio" del menú (no depende de permisos). */
export const home = { path: "/", label: "Inicio", icon: Home };

export const sections: Section[] = [
  {
    path: "/academico",
    label: "Académico",
    descripcion: "Facultades, carreras, asignaturas y mallas",
    icon: GraduationCap,
    tiles: [
      {
        path: "/academico/facultades",
        label: "Facultades",
        descripcion: "Gestión de facultades y unidades académicas",
        icon: Building2,
        permiso: "facultades.leer",
        implemented: true,
      },
      {
        path: "/academico/carreras",
        label: "Carreras",
        descripcion: "Carreras y planes de estudio",
        icon: BookOpen,
        permiso: "carreras.leer",
        implemented: true,
      },
      {
        path: "/academico/asignaturas",
        label: "Asignaturas",
        descripcion: "Catálogo de materias y carga horaria",
        icon: Library,
        permiso: "asignaturas.leer",
        implemented: true,
      },
      {
        path: "/academico/mallas",
        label: "Mallas curriculares",
        descripcion: "Composición por semestre y versión",
        icon: Table2,
        permiso: "mallas.leer",
        implemented: true,
      },
      {
        path: "/academico/promociones",
        label: "Promociones",
        descripcion: "Vigencia de cada malla por promoción",
        icon: Users,
        permiso: "promociones.leer",
        implemented: true,
      },
      {
        path: "/academico/equivalencias",
        label: "Equivalencias",
        descripcion: "Equivalencias entre asignaturas",
        icon: ArrowLeftRight,
        permiso: "asignaturas.leer",
        implemented: true,
      },
      {
        path: "/academico/correlatividades",
        label: "Prerrequisitos",
        descripcion: "Correlatividades entre asignaturas",
        icon: Network,
        permiso: "mallas.leer",
        implemented: true,
      },
    ],
  },
  {
    path: "/seguridad",
    label: "Seguridad",
    descripcion: "Usuarios, roles y permisos de acceso",
    icon: ShieldCheck,
    tiles: [
      {
        path: "/seguridad/usuarios",
        label: "Usuarios",
        descripcion: "Cuentas, estado y roles asignados",
        icon: UserCog,
        permiso: "usuarios.leer",
        implemented: true,
      },
      {
        path: "/seguridad/roles",
        label: "Roles y permisos",
        descripcion: "Roles y sus permisos de acceso",
        icon: ShieldHalf,
        permiso: "roles.leer",
        implemented: true,
      },
    ],
  },
  {
    path: "/reportes",
    label: "Reportes",
    descripcion: "Consultas de la estructura curricular",
    icon: FileBarChart,
    tiles: [
      {
        path: "/reportes/malla",
        label: "Malla por carrera",
        descripcion: "Vista de la malla vigente",
        icon: Table2,
        permiso: "mallas.leer",
      },
      {
        path: "/reportes/promociones",
        label: "Vigencia de promociones",
        descripcion: "Promociones y malla aplicable",
        icon: Users,
        permiso: "promociones.leer",
      },
    ],
  },
];
