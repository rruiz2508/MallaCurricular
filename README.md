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
| API y pantallas de seguridad: usuarios, roles y asignación de permisos | ✅ Implementadas |
| Frontend: login, navegación por permisos, facultades, usuarios y roles | ✅ Implementado |
| API y pantallas (ABM) de carreras, asignaturas, equivalencias, mallas con prerrequisitos y versionado, y promociones | ✅ Implementadas |
| Reportes (malla por carrera y vigencia de promociones) | ⏳ Pendiente (la vista `v_reporte_promocion` ya entrega los datos) |

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
    api/v1/            # endpoints (/me, /facultades, /carreras, /asignaturas, /equivalencias,
                       #            /mallas, /promociones, /usuarios, /roles, /permisos)
    core/              # configuración, conexión y validación de JWT
  tests/               # pruebas de API, JWT y esquemas
frontend/
  src/
    auth/              # sesión de Supabase y perfil/permisos
    components/        # layout y cuadrícula de módulos
    lib/               # cliente HTTP y cliente de Supabase
    pages/             # Login, Inicio, secciones y un módulo por pantalla (ABM)
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
5. `20261030120000_reporte_malla.sql`
6. `20261030150000_auditoria.sql`

Deben ejecutarse en Supabase porque usan `auth.users` y `auth.uid()`. El resultado son los esquemas `seguridad` (usuarios, roles y permisos) y `academico` (facultades, carreras, asignaturas, mallas, relaciones, equivalencias y promociones). La vista `academico.v_reporte_promocion` entrega el reporte de malla de una promoción (semestre, año lectivo, códigos, créditos, horas y prerrequisitos), como el de `Docs/Curriculum_Propuesto_2023 - LCI-SI_Ruiz_Robert.pdf`.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del proyecto. Solo el backend la usa, para crear usuarios y cambiar contraseñas en Supabase Auth (sin ella esas operaciones responden 503). Nunca debe llegar al frontend. |
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
| GET / POST | `/api/v1/carreras` | `carreras.leer` / `.gestionar` | Lista y alta de carreras. |
| PATCH / DELETE | `/api/v1/carreras/{id}` | `carreras.gestionar` | Edición y baja (409 si tiene mallas o promociones). |
| GET / POST | `/api/v1/asignaturas` | `asignaturas.leer` / `.gestionar` | Catálogo de asignaturas. |
| PATCH / DELETE | `/api/v1/asignaturas/{id}` | `asignaturas.gestionar` | Edición y baja (409 si está en una malla). |
| GET / POST | `/api/v1/equivalencias` | `asignaturas.leer` / `.gestionar` | Pares de asignaturas equivalentes (simétricos). |
| PATCH / DELETE | `/api/v1/equivalencias/{a}/{b}` | `asignaturas.gestionar` | Observación y baja del par, en cualquier orden. |
| GET / POST | `/api/v1/mallas` | `mallas.leer` / `.gestionar` | Lista y alta de mallas (nacen en borrador, versión automática). |
| GET / PATCH / DELETE | `/api/v1/mallas/{id}` | `mallas.leer` / `.gestionar` | Detalle por semestre; solo un borrador se edita o elimina. |
| POST | `/api/v1/mallas/{id}/clonar` | `mallas.gestionar` | Nueva versión en borrador copiando asignaturas y prerrequisitos. |
| POST | `/api/v1/mallas/{id}/publicar` · `/archivar` | `mallas.publicar` | Ciclo de vida: borrador → publicada → archivada. |
| POST / PATCH / DELETE | `/api/v1/mallas/{id}/asignaturas[/{asignatura_id}]` | `mallas.gestionar` | Composición del borrador (semestre, tipo, orden). |
| POST / DELETE | `/api/v1/mallas/{id}/relaciones[/{relacion_id}]` | `mallas.gestionar` | Prerrequisitos (deben estar en un semestre anterior). |
| GET / POST | `/api/v1/promociones` | `promociones.leer` / `.gestionar` | Cohortes con su vigencia calculada; solo sobre mallas publicadas. |
| PATCH / DELETE | `/api/v1/promociones/{id}` | `promociones.gestionar` | Cambio de malla o años de gracia, y baja. |
| GET | `/api/v1/permisos` | `roles.leer` | Catálogo de permisos del sistema, por módulo. |
| GET | `/api/v1/roles` | `roles.leer` | Roles con sus permisos y cantidad de usuarios. |
| POST | `/api/v1/roles` | `roles.gestionar` | Crea un rol con sus permisos (409 si el nombre existe, 422 si un permiso no existe). |
| PATCH | `/api/v1/roles/{id}` | `roles.gestionar` | Edita el rol y/o reemplaza sus permisos; 409 ante roles protegidos. |
| DELETE | `/api/v1/roles/{id}` | `roles.gestionar` | Elimina un rol; 409 si es de sistema o tiene usuarios. |
| GET | `/api/v1/usuarios` | `usuarios.leer` | Usuarios con sus roles. |
| GET | `/api/v1/usuarios/roles` | `usuarios.leer` | Roles activos asignables. |
| POST | `/api/v1/usuarios` | `usuarios.gestionar` | Crea el usuario en Supabase Auth y le asigna roles (409 si el correo existe). |
| PATCH | `/api/v1/usuarios/{id}` | `usuarios.gestionar` | Edita datos, estado o roles; 409 si dejaría al sistema sin administradores activos. |
| PUT | `/api/v1/usuarios/{id}/password` | `usuarios.gestionar` | Establece una nueva contraseña. |

## Modelo de permisos

- El JWT de Supabase se valida con las claves públicas del proyecto (JWKS), así que el backend no guarda secretos.
- Los permisos efectivos se calculan desde `seguridad.usuario_rol → rol_permiso → permiso`; cada endpoint declara el suyo con `require_permission(...)`.
- Los permisos son un catálogo fijo (cada endpoint declara el suyo): desde la interfaz se asignan a roles, pero no se crean.
- Roles base: `administrador`, `direccion_academica`, `coordinador_carrera`, `secretaria_academica` y `consulta`. Se pueden crear roles adicionales con cualquier conjunto de permisos. Los roles de sistema no se renombran ni se eliminan, y `administrador` no se puede desactivar ni perder permisos. Siempre debe quedar al menos un administrador activo, y nadie puede desactivarse a sí mismo.
- Ocultar botones o menús en el frontend es solo comodidad: el backend responde 403 ante cualquier acción sin permiso.

## Auditoría de autoría

Cada tabla de `seguridad` y `academico` tiene `created_by` (quién insertó el registro) y `updated_by` (quién lo modificó por última vez), ambas referencias a `seguridad.usuario`.

- Las completa un trigger (`seguridad.auditar`), no el cliente, así que no se pueden falsificar: `created_by` no cambia nunca en un update.
- El backend se conecta con un rol que omite RLS, por lo que en cada petición fija el usuario autenticado en la transacción (`app.current_user_id`). Si se accede directamente con el cliente de Supabase, el trigger usa `auth.uid()`.
- Las cuentas creadas desde la aplicación registran a quien las dio de alta (el id viaja en `app_metadata`, que solo escribe la Admin API).
- Sin usuario de sesión (SQL Editor, migraciones, datos de prueba) las columnas quedan en `null`, igual que los registros anteriores a esta migración. Si se elimina un usuario, sus registros se conservan y la autoría pasa a `null`.

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

El backend tiene pruebas de API, de validación de JWT y de los esquemas de entrada (facultades, roles, usuarios y módulos académicos). El frontend aún no tiene pruebas automatizadas: se valida con el build de TypeScript/Vite y con pruebas manuales de las pantallas.

## Documentación

- [Acta de constitución del proyecto](Docs/Acta_Constitucion_Gestion_Malla_Curricular.pdf)
- Migraciones SQL: `supabase/migrations/`
