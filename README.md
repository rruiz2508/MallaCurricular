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
| Calidad frontend | Node Test Runner y herramientas del ecosistema Vite |

## Organización técnica

- **Frontend:** aplicación web responsive y modular que consume exclusivamente la API del backend.
- **Backend:** concentra las reglas de negocio, la autorización y la persistencia.
- **Base de datos:** organiza la información por contextos o módulos académicos.
- **Seguridad:** la autorización se valida en el backend, aun cuando existan controles complementarios en la base de datos.
