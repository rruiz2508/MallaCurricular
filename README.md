# Sistema de Gestión de Malla Curricular

Aplicación web para administrar de manera centralizada, trazable y segura las mallas curriculares de las carreras de la Universidad Autónoma de Asunción.

## Descripción

El sistema centraliza y ordena la información académica relacionada con facultades, carreras, planes o mallas curriculares, asignaturas, relaciones entre materias y versiones vigentes de cada plan. Facilita la creación, consulta, actualización, versionado y control de las relaciones académicas entre asignaturas.

## Objetivos de la aplicación

- Administrar la estructura académica: facultades, carreras y planes de estudio.
- Registrar y mantener el catálogo de asignaturas con sus principales datos académicos.
- Construir y mantener mallas curriculares organizadas por carrera, plan, semestre/año y versión.
- Gestionar correlatividades, prerrequisitos y otras relaciones entre asignaturas.
- Mantener el historial y la vigencia de las versiones de una malla curricular.
- Ofrecer consultas y reportes para revisar la estructura curricular.
- Controlar el acceso a las funciones administrativas mediante autenticación, roles y permisos.

## Alcance funcional

### Funcionalidades incluidas

| Módulo | Descripción |
|---|---|
| **Gestión de Seguridad** | Autenticación de usuarios, gestión de sesión, administración de usuarios, roles y permisos. |
| **Estructura Académica** | Administración de facultades/unidades académicas, carreras y datos organizativos. |
| **Gestión de Asignaturas** | Catálogo de materias con código, nombre, carga horaria, estado y otros atributos académicos. |
| **Gestión de Mallas Curriculares** | Creación y edición de planes/mallas por carrera, versión y período académico (semestre, año u otra estructura). |
| **Reglas y Correlatividades** | Definición de prerrequisitos, correlatividades, equivalencias u otras restricciones académicas. |
| **Versionado y Vigencia** | Historial, publicación, vigencia y trazabilidad de las modificaciones de una malla. |
| **Consultas y Reportes** | Visualización de la malla y reportes básicos de la estructura de una carrera. |

### Fuera de alcance

- Gestión de inscripciones de estudiantes.
- Gestión de calificaciones, asistencia o actas académicas.
- Gestión financiera, aranceles o cobranzas.
- Aula virtual o gestión de contenidos de cursos.
- Integraciones con sistemas académicos institucionales existentes.

## Usuarios previstos

- Autoridades académicas / Facultad
- Dirección o Coordinación Académica
- Coordinadores o Directores de Carrera
- Secretaría Académica
- Docentes (consulta)
- Estudiantes (consulta de la malla vigente, si se habilita acceso público)

## Estado del proyecto

| Área | Estado |
|---|---|
| Base de datos: seguridad (usuarios, roles, permisos y RLS) | ✅ Completa |
| Base de datos: estructura académica (facultades, carreras, asignaturas) | ✅ Completa |
| Base de datos: mallas versionadas, promociones, equivalencias y relaciones | ✅ Completa |
| API de sesión (`/me`) y facultades | ✅ Implementada |
| Frontend: login, navegación por permisos y módulo de facultades | ✅ Implementado |
| API y pantallas de carreras, asignaturas, mallas, promociones, equivalencias, correlatividades y administración de usuarios/roles | ⏳ Pendiente (páginas "en construcción") |

El módulo de **facultades** es el de referencia: sirve como patrón para el resto (esquemas Pydantic, consultas SQL parametrizadas, permisos por endpoint y formulario modal en el frontend).

## Tecnologías

| Área | Tecnología |
|---|---|
| Arquitectura | Monolito modular con frontend y backend separados |
| Frontend | React 19, TypeScript, Vite |
| Backend | Python 3.12+, FastAPI, Uvicorn, Pydantic |
| Base de datos | PostgreSQL 17 en Supabase |
| Acceso a datos | SQLAlchemy 2.x Core (acceso asíncrono) |
| Autenticación | Supabase Auth / JWT |
| Migraciones | Migraciones SQL versionadas (Alembic si se requiere) |
| API | REST sobre HTTP/JSON, versionada bajo `/api/v1` |
| Calidad backend | Pytest, pytest-asyncio, Ruff, mypy |
| Calidad frontend | TypeScript en modo estricto y build de Vite (sin pruebas automatizadas todavía) |

## Arquitectura y organización técnica

- **Frontend:** aplicación web responsive y modular que consume exclusivamente la API del backend (solo usa Supabase para autenticarse).
- **Backend:** concentra las reglas de negocio, la autorización y la persistencia.
- **Base de datos:** organiza la información por contextos (`seguridad` y `academico`).
- **Seguridad:** la autorización se valida en el backend; las políticas RLS son un control complementario.

```text
backend/
  app/
    api/v1/            # endpoints (/me, /facultades)
    core/              # configuración, conexión y validación de JWT
  tests/               # pruebas de API, JWT y esquemas
frontend/
  src/
    auth/              # sesión de Supabase y perfil/permisos
    components/        # layout y cuadrícula de módulos
    lib/               # cliente HTTP y cliente de Supabase
    pages/             # Login, Inicio, secciones y Facultades
    modules.ts         # catálogo de módulos filtrado por permisos
supabase/migrations/   # migraciones SQL versionadas
Docs/                  # acta de constitución
```

## Puesta en marcha

### Requisitos

- Python 3.12 o superior.
- Node.js 20 o superior.
- Proyecto Supabase con Auth y Postgres.

### 1. Base de datos

Aplicar en orden las migraciones de `supabase/migrations/` desde el SQL Editor de Supabase o con `supabase db push`:

1. `20261029203802_seguridad.sql`
2. `20261029203822_estructura_academica.sql`
3. `20261029210756_mallas_promociones.sql`
4. `20261029211146_correlativa_como_prerrequisito.sql`

Deben ejecutarse en Supabase porque usan `auth.users` y `auth.uid()`. El resultado son los esquemas `seguridad` (usuarios, roles y permisos) y `academico` (facultades, carreras, asignaturas, mallas, relaciones, equivalencias y promociones).

### 2. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
```

Variables de `backend/.env`:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Postgres (directa o pooler). Se acepta el formato `postgresql://`; el backend agrega el driver `asyncpg`. |
| `SUPABASE_URL` | URL del proyecto; de ella se derivan el JWKS y el emisor del JWT. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma (por defecto `http://localhost:5173`). |

La API queda en <http://localhost:8000> y su documentación interactiva en <http://localhost:8000/docs>.

### 3. Usuario inicial

Crear el usuario en *Authentication → Users* de Supabase y asignarle un rol desde el SQL Editor (el trigger crea el perfil, pero no asigna roles):

```sql
insert into seguridad.usuario_rol (usuario_id, rol_id)
select u.id, r.id
from seguridad.usuario u
join seguridad.rol r on r.nombre = 'administrador'
where u.email = 'correo@ejemplo.com';
```

### 4. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Variables de `frontend/.env.local`:

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (o `anon` key en proyectos antiguos). Es pública por diseño. |

La aplicación queda en <http://localhost:5173>; Vite redirige `/api` al backend para evitar CORS en desarrollo.

> No versionar `backend/.env` ni `frontend/.env.local`: están incluidos en `.gitignore`.

## API

Todas las rutas de negocio cuelgan de `/api/v1` y requieren `Authorization: Bearer <access_token>`, salvo `/health`.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/health` | — | Estado del servicio (no usa base ni autenticación). |
| GET | `/api/v1/me` | sesión válida | Perfil, roles y permisos efectivos del usuario. |
| GET | `/api/v1/facultades` | `facultades.leer` | Lista de facultades. |
| POST | `/api/v1/facultades` | `facultades.gestionar` | Crea una facultad (409 si el código o el nombre ya existen). |
| PATCH | `/api/v1/facultades/{id}` | `facultades.gestionar` | Edición parcial; 400 sin cambios, 404 si no existe, 422 con valores inválidos. |

## Modelo de permisos

- El JWT de Supabase se valida con las claves públicas del proyecto (JWKS), así que el backend no guarda secretos.
- Los permisos efectivos se calculan desde `seguridad.usuario_rol → rol_permiso → permiso`; cada endpoint declara el suyo con `require_permission(...)`.
- Roles base: `administrador`, `direccion_academica`, `coordinador_carrera`, `secretaria_academica` y `consulta`. Se pueden crear roles adicionales con cualquier conjunto de permisos.
- Ocultar botones o menús en el frontend es solo comodidad: el backend responde 403 ante cualquier acción sin permiso.

## Calidad y pruebas

```bash
cd backend
source .venv/bin/activate
pytest -q
ruff check .
ruff format --check .
mypy app
```

```bash
cd frontend
npm run build
```

El backend tiene pruebas de API, de validación de JWT y de los esquemas de entrada. El frontend aún no tiene pruebas automatizadas: se valida con el build de TypeScript/Vite y con pruebas manuales del login y del módulo de facultades.

## Documentación

- [Acta de constitución del proyecto](Docs/Acta_Constitucion_Gestion_Malla_Curricular.pdf)
- Migraciones SQL: `supabase/migrations/`
