-- Incremento 2: estructura academica minima (facultades, carreras, asignaturas)
-- y administracion inicial de planes de estudio. El versionado, vigencia y la
-- composicion de la malla por periodos se agregan en incrementos posteriores.

create schema if not exists academico;

-- ---------------------------------------------------------------- tablas

create table academico.facultad (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null unique,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academico.carrera (
  id uuid primary key default gen_random_uuid(),
  facultad_id uuid not null references academico.facultad (id) on delete restrict,
  codigo text not null,
  nombre text not null,
  titulo_otorgado text,
  duracion_semestres integer check (duracion_semestres > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facultad_id, codigo),
  unique (facultad_id, nombre)
);

create table academico.asignatura (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  carga_horaria_total integer not null check (carga_horaria_total > 0),
  horas_teoricas integer check (horas_teoricas >= 0),
  horas_practicas integer check (horas_practicas >= 0),
  estado text not null default 'activa' check (estado in ('activa', 'inactiva', 'en_revision')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (coalesce(horas_teoricas, 0) + coalesce(horas_practicas, 0) <= carga_horaria_total)
);

create table academico.plan_estudio (
  id uuid primary key default gen_random_uuid(),
  carrera_id uuid not null references academico.carrera (id) on delete restrict,
  codigo text not null,
  nombre text not null,
  anio integer not null check (anio between 1900 and 2200),
  resolucion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrera_id, codigo)
);

create trigger facultad_set_updated_at before update on academico.facultad
  for each row execute function seguridad.set_updated_at();
create trigger carrera_set_updated_at before update on academico.carrera
  for each row execute function seguridad.set_updated_at();
create trigger asignatura_set_updated_at before update on academico.asignatura
  for each row execute function seguridad.set_updated_at();
create trigger plan_estudio_set_updated_at before update on academico.plan_estudio
  for each row execute function seguridad.set_updated_at();

-- ------------------------------------------------------- permisos y roles

insert into seguridad.permiso (codigo, modulo, descripcion) values
  ('facultades.leer',     'academico', 'Ver facultades'),
  ('facultades.gestionar','academico', 'Crear y editar facultades'),
  ('carreras.leer',       'academico', 'Ver carreras'),
  ('carreras.gestionar',  'academico', 'Crear y editar carreras'),
  ('asignaturas.leer',    'academico', 'Ver el catalogo de asignaturas'),
  ('asignaturas.gestionar','academico','Crear y editar asignaturas'),
  ('planes.leer',         'academico', 'Ver planes de estudio'),
  ('planes.gestionar',    'academico', 'Crear y editar planes de estudio');

-- administrador: todos los permisos existentes
insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r cross join seguridad.permiso p
where r.nombre = 'administrador'
on conflict do nothing;

-- direccion_academica: lectura y gestion academica completa
insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p on p.modulo = 'academico'
where r.nombre = 'direccion_academica'
on conflict do nothing;

-- coordinador_carrera: lee todo, gestiona asignaturas y planes
insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p
  on p.codigo in ('facultades.leer', 'carreras.leer', 'asignaturas.leer', 'asignaturas.gestionar',
                  'planes.leer', 'planes.gestionar')
where r.nombre = 'coordinador_carrera'
on conflict do nothing;

-- secretaria_academica: lee todo, mantiene el catalogo de asignaturas
insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p
  on p.codigo in ('facultades.leer', 'carreras.leer', 'asignaturas.leer', 'asignaturas.gestionar',
                  'planes.leer')
where r.nombre = 'secretaria_academica'
on conflict do nothing;

-- consulta: solo lectura
insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p
  on p.codigo in ('facultades.leer', 'carreras.leer', 'asignaturas.leer', 'planes.leer')
where r.nombre = 'consulta'
on conflict do nothing;

-- -------------------------------------------------------------------- RLS

alter table academico.facultad enable row level security;
alter table academico.carrera enable row level security;
alter table academico.asignatura enable row level security;
alter table academico.plan_estudio enable row level security;

grant usage on schema academico to authenticated;
grant select, insert, update, delete on
  academico.facultad, academico.carrera, academico.asignatura, academico.plan_estudio
  to authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('facultad',     'facultades.leer',  'facultades.gestionar'),
      ('carrera',      'carreras.leer',    'carreras.gestionar'),
      ('asignatura',   'asignaturas.leer', 'asignaturas.gestionar'),
      ('plan_estudio', 'planes.leer',      'planes.gestionar')
    ) as v(tabla, leer, gestionar)
  loop
    execute format(
      'create policy %I on academico.%I for select to authenticated using ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_select', t.tabla, t.leer);
    execute format(
      'create policy %I on academico.%I for insert to authenticated with check ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_insert', t.tabla, t.gestionar);
    execute format(
      'create policy %I on academico.%I for update to authenticated using ((select seguridad.tiene_permiso(%L))) with check ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_update', t.tabla, t.gestionar, t.gestionar);
    execute format(
      'create policy %I on academico.%I for delete to authenticated using ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_delete', t.tabla, t.gestionar);
  end loop;
end;
$$;
