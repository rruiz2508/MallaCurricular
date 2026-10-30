# Guía de Rediseño de Interfaz: Sistema Académico (Malla Curricular)

Este documento recopila las recomendaciones de diseño, paleta de colores adaptable (Modo Claro / Modo Oscuro), rediseño de componentes y código de ejemplo para modernizar la interfaz del sistema académico.

---

## 1. Diagnóstico de la Interfaz Actual

Analizando la versión previa, se identifican las siguientes áreas de oportunidad:

1. **Saturación y peso visual excesivo:** Las tarjetas de módulos usan rellenos completos de azul celeste brillante con bordes dorados, lo que genera ruido visual y compite por la atención del usuario.
2. **Jerarquía visual plana:** Al tener todas las tarjetas el mismo color dominante, ninguna destaca y se dificulta el escaneo rápido de información.
3. **Contraste no balanceado:** La combinación de fondos azul oscuro profundo con bordes y tipografías lineales brillantes genera fatiga en jornadas de uso prolongadas.
4. **Ausencia de modo claro:** Para entornos educativos y administrativos de oficina, un modo claro limpio y sobrio es indispensable para la lectura de tablas y datos densos.

---

## 2. Sistema de Diseño y Tokens de Color

La estrategia se basa en una paleta tipo **Slate SaaS**: fondos y superficies neutras con acentos azules institucionales reservados para botones interactivos, estados activos e íconos.

### Tabla de Equivalencias (Design Tokens)

| Token Semántico | Modo Claro (Light) | Modo Oscuro (Dark) | Uso en Interfaz |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#F8FAFC` (Slate 50) | `#0B0F17` (Slate 950) | Fondo principal de la vista |
| `--surface` | `#FFFFFF` (Blanco) | `#151E2E` (Slate 900) | Sidebar, cards, modales, contenedor tabla |
| `--surface-subtle` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Hover en filas, fondos de íconos |
| `--border` | `#E2E8F0` (Slate 200) | `#26354A` (Slate 700/800) | Bordes de tarjetas, divisores de tablas |
| `--text-primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Títulos principales, códigos de facultades |
| `--text-muted` | `#64748B` (Slate 500) | `#94A3B8` (Slate 400) | Subtítulos, descripciones secundarias |
| `--brand-primary` | `#2563EB` (Royal Blue) | `#3B82F6` (Electric Blue) | Botones primarios, enlaces activos |
| `--brand-focus` | `#DBEAFE` (Blue 100) | `rgba(59, 130, 246, 0.15)` | Contenedores de iconos temáticos |
| `--status-success` | `#059669` (Emerald 600) | `#10B981` (Emerald 500) | Insignias de estado activo |

---

## 3. Rediseño de Componentes Clave

### A. Módulos y Accesos Directos (Cards)
* **Estructura:** Fondo neutro (`--surface`) con borde sutil de 1 px.
* **Ícono:** Aislado en un contenedor de $44 \times 44\text{ px}$ con esquinas redondeadas y fondo translúcido (`--brand-focus`).
* **Microinteracciones:** Al pasar el cursor (*hover*), elevar la tarjeta $2\text{ px}$ en el eje Y y teñir sutilmente el borde con el color primario.

```text
┌────────────────────────────────────────────────────────┐
│  ┌──────┐                                              │
│  │  🏛️  │  Facultades                                  │
│  └──────┘  Gestión de decanatos y sedes                │
│                                                   →    │
└────────────────────────────────────────────────────────┘
```

### B. Barra Lateral (Sidebar) y Cabecera
* **Sidebar cohesiva:** Usar el mismo fondo neutro de superficie en lugar de un tono azul petróleo desalineado.
* **Navegación:** Ítems con esquinas redondeadas (`rounded-lg`). El elemento activo debe resaltar con fondo suave y texto en tono de marca.
* **Selector de Tema:** Añadir en la barra superior un botón toggle (icono Sol / Luna) que persista la preferencia en `localStorage`.

### C. Tablas de Datos y Badges (Ej. Facultades)
* **Cabecera:** Tipografía en mayúsculas de menor tamaño (`font-semibold text-xs tracking-wider`), color atenuado.
* **Badges de estado:** Utilizar cápsulas redondeadas (`pill badges`) con bajo contraste y borde fino en lugar de texto plano:
  * *Modo Claro:* Fondo verde pastel (`#ECFDF5`), texto verde oscuro (`#065F46`).
  * *Modo Oscuro:* Fondo verde traslúcido (`rgba(16, 185, 129, 0.15)`), texto verde esmeralda (`#34D399`).

---

## 4. Implementación con CSS Nativo (Variables)

```css
/* =========================================
   Variables de Tema (Light por defecto)
   ========================================= */
:root {
  --bg-app: #f8fafc;
  --bg-surface: #ffffff;
  --bg-surface-hover: #f1f5f9;
  --border-color: #e2e8f0;

  --text-main: #0f172a;
  --text-sub: #64748b;

  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-light: #eff6ff;

  --badge-success-bg: #d1fae5;
  --badge-success-text: #065f46;
  --badge-success-border: #a7f3d0;

  --card-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06);
}

/* =========================================
   Variables para Modo Oscuro
   ========================================= */
.dark {
  --bg-app: #0b0f17;
  --bg-surface: #131b2a;
  --bg-surface-hover: #1c273a;
  --border-color: #243248;

  --text-main: #f8fafc;
  --text-sub: #94a3b8;

  --primary: #3b82f6;
  --primary-hover: #60a5fa;
  --primary-light: rgba(59, 130, 246, 0.15);

  --badge-success-bg: rgba(16, 185, 129, 0.15);
  --badge-success-text: #34d399;
  --badge-success-border: rgba(16, 185, 129, 0.25);

  --card-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.4);
}

/* =========================================
   Estilos de Componentes Base
   ========================================= */
body {
  background-color: var(--bg-app);
  color: var(--text-main);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.academic-card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: var(--card-shadow);
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.academic-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
}

.academic-card-icon {
  background-color: var(--primary-light);
  color: var(--primary);
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

---

## 5. Implementación con Tailwind CSS

### A. Tarjeta de Módulo
```html
<div class="flex items-center gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:border-blue-500 dark:hover:border-blue-400 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
  <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
    <!-- SVG Icon -->
    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  </div>
  <div>
    <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-base">Facultades</h3>
    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sedes y unidades académicas</p>
  </div>
</div>
```

### B. Tabla de Facultades
```html
<div class="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
  <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
    <thead class="bg-slate-50 dark:bg-slate-900/60">
      <tr>
        <th class="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Código</th>
        <th class="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</th>
        <th class="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
        <th class="px-6 py-3.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
      <tr class="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
        <td class="px-6 py-4 font-mono font-medium text-slate-900 dark:text-slate-100">FACEYE</td>
        <td class="px-6 py-4 text-slate-700 dark:text-slate-300">Facultad de Ciencias Económicas y Empresariales</td>
        <td class="px-6 py-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            Activa
          </span>
        </td>
        <td class="px-6 py-4 text-right">
          <button class="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 6. Recomendaciones de Accesibilidad y Usabilidad

1. **Cumplimiento WCAG AA:** Todas las combinaciones de color de texto contra fondo superan el ratio mínimo de contraste de $4.5:1$ para texto normal.
2. **Fuentes sans-serif modernas:** Emplear fuentes con buena legibilidad tabular (como *Inter*, *Geist* o las fuentes de sistema predeterminadas).
3. **Persistencia del tema:** Guardar la preferencia en `localStorage.getItem('theme')` y evaluar `window.matchMedia('(prefers-color-scheme: dark)')` en la primera carga para respetar la configuración del sistema operativo.