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
  Table2,
  UserCog,
  Users,
  ShieldHalf,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Tile {
  path: string;
  label: string;
  icon: LucideIcon;
  permiso: string;
  implemented?: boolean;
}

export interface Section {
  path: string;
  label: string;
  icon: LucideIcon;
  tiles: Tile[];
}

export const home = { path: "/", label: "Inicio", icon: Home };

export const sections: Section[] = [
  {
    path: "/academico",
    label: "Académico",
    icon: GraduationCap,
    tiles: [
      { path: "/academico/facultades", label: "Facultades", icon: Building2, permiso: "facultades.leer", implemented: true },
      { path: "/academico/carreras", label: "Carreras", icon: BookOpen, permiso: "carreras.leer" },
      { path: "/academico/asignaturas", label: "Asignaturas", icon: Library, permiso: "asignaturas.leer" },
      { path: "/academico/mallas", label: "Mallas curriculares", icon: Table2, permiso: "mallas.leer" },
      { path: "/academico/promociones", label: "Promociones", icon: Users, permiso: "promociones.leer" },
      { path: "/academico/equivalencias", label: "Equivalencias", icon: ArrowLeftRight, permiso: "asignaturas.leer" },
      { path: "/academico/correlatividades", label: "Prerrequisitos", icon: Network, permiso: "mallas.leer" },
    ],
  },
  {
    path: "/seguridad",
    label: "Seguridad",
    icon: ShieldCheck,
    tiles: [
      { path: "/seguridad/usuarios", label: "Usuarios", icon: UserCog, permiso: "usuarios.leer" },
      { path: "/seguridad/roles", label: "Roles y permisos", icon: ShieldHalf, permiso: "roles.leer" },
    ],
  },
  {
    path: "/reportes",
    label: "Reportes",
    icon: FileBarChart,
    tiles: [
      { path: "/reportes/malla", label: "Malla por carrera", icon: Table2, permiso: "mallas.leer" },
      { path: "/reportes/promociones", label: "Vigencia de promociones", icon: Users, permiso: "promociones.leer" },
    ],
  },
];
