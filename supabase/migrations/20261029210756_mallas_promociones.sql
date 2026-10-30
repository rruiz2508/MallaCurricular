-- Incrementos 3 y 4: mallas curriculares versionadas por carrera, composicion por
-- semestre, relaciones entre asignaturas y promociones.
--
-- Modelo:
--   * malla_curricular: una version de la malla de una carrera (borrador -> publicada -> archivada).
--   * malla_asignatura: asignaturas de la malla y el semestre en que se dictan.
--   * malla_relacion: prerrequisitos y correlativas, dentro de una malla.
--   * asignatura_equivalencia: equivalencias entre asignaturas del catalogo (suelen cruzar versiones).
--   * promocion: cohorte de ingreso de una carrera, asociada a una malla. Su vigencia es
--     la duracion de la carrera mas anios_gracia (3 por defecto).
--
-- Reemplaza academico.plan_estudio (vacia), cuyo rol pasa a cumplir malla_curricular.

drop table academico.plan_estudio;

update seguridad.permiso
set codigo = 'mallas.leer', descripcion = 'Ver mallas curriculares y sus versiones'
where codigo = 'planes.leer';
update seguridad.permiso
set codigo = 'mallas.gestionar', descripcion = 'Crear y editar mallas curriculares en borrador'
where codigo = 'planes.gestionar';

insert into seguridad.permiso (codigo, modulo, descripcion) values
  ('mallas.publicar',      'academico', 'Publicar y archivar versiones de malla'),
  ('promociones.leer',     'academico', 'Ver promociones'),
  ('promociones.gestionar','academico', 'Crear y editar promociones');

-- ---------------------------------------------------------------- tablas

create table academico.malla_curricular (
  id uuid primary key default gen_random_uuid(),
  carrera_id uuid not null references academico.carrera (id) on delete restrict,
  version integer not null check (version > 0),
  nombre text not null,
  resolucion text,
  duracion_semestres integer not null check (duracion_semestres between 1 and 20),
  estado text not null default 'borrador' check (estado in ('borrador', 'publicada', 'archivada')),
  publicada_at timestamptz,
  archivada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrera_id, version),
  unique (id, carrera_id)
);

create table academico.malla_asignatura (
  malla_id uuid not null references academico.malla_curricular (id) on delete cascade,
  asignatura_id uuid not null references academico.asignatura (id) on delete restrict,
  semestre integer not null check (semestre >= 1),
  tipo text not null default 'obligatoria' check (tipo in ('obligatoria', 'electiva')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (malla_id, asignatura_id)
);
create index malla_asignatura_asignatura_id_idx on academico.malla_asignatura (asignatura_id);

create table academico.malla_relacion (
  id uuid primary key default gen_random_uuid(),
  malla_id uuid not null,
  asignatura_id uuid not null,
  relacionada_id uuid not null,
  tipo text not null check (tipo in ('prerrequisito', 'correlativa')),
  created_at timestamptz not null default now(),
  unique (malla_id, asignatura_id, relacionada_id, tipo),
  check (asignatura_id <> relacionada_id),
  foreign key (malla_id, asignatura_id)
    references academico.malla_asignatura (malla_id, asignatura_id) on delete cascade,
  foreign key (malla_id, relacionada_id)
    references academico.malla_asignatura (malla_id, asignatura_id) on delete cascade
);
create index malla_relacion_relacionada_idx on academico.malla_relacion (malla_id, relacionada_id);

create table academico.asignatura_equivalencia (
  asignatura_id uuid not null references academico.asignatura (id) on delete cascade,
  equivalente_id uuid not null references academico.asignatura (id) on delete cascade,
  observacion text,
  created_at timestamptz not null default now(),
  primary key (asignatura_id, equivalente_id),
  check (asignatura_id < equivalente_id)
);
create index asignatura_equivalencia_equivalente_idx on academico.asignatura_equivalencia (equivalente_id);

create table academico.promocion (
  id uuid primary key default gen_random_uuid(),
  carrera_id uuid not null references academico.carrera (id) on delete restrict,
  anio integer not null check (anio between 1900 and 2200),
  malla_id uuid not null,
  anios_gracia integer not null default 3 check (anios_gracia >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrera_id, anio),
  foreign key (malla_id, carrera_id)
    references academico.malla_curricular (id, carrera_id) on delete restrict
);
create index promocion_malla_idx on academico.promocion (malla_id, carrera_id);

create trigger malla_curricular_set_updated_at before update on academico.malla_curricular
  for each row execute function seguridad.set_updated_at();
create trigger malla_asignatura_set_updated_at before update on academico.malla_asignatura
  for each row execute function seguridad.set_updated_at();
create trigger promocion_set_updated_at before update on academico.promocion
  for each row execute function seguridad.set_updated_at();

-- ---------------------------------------------------- reglas de consistencia

-- Version automatica por carrera, y ciclo de vida de la malla.
create function academico.controlar_malla()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.version is null then
      select coalesce(max(m.version), 0) + 1 into new.version
      from academico.malla_curricular m
      where m.carrera_id = new.carrera_id;
    end if;
    new.estado := 'borrador';
    new.publicada_at := null;
    new.archivada_at := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.estado <> 'borrador' then
      raise exception 'Solo se pueden eliminar mallas en borrador';
    end if;
    return old;
  end if;

  if new.carrera_id <> old.carrera_id or new.version <> old.version then
    raise exception 'La carrera y la version de una malla no se pueden cambiar';
  end if;

  if old.estado <> 'borrador' and new.duracion_semestres <> old.duracion_semestres then
    raise exception 'No se puede cambiar la duracion de una malla publicada o archivada';
  end if;

  if new.duracion_semestres < (
    select coalesce(max(ma.semestre), 0)
    from academico.malla_asignatura ma
    where ma.malla_id = new.id
  ) then
    raise exception 'La malla ya tiene asignaturas en semestres posteriores a la duracion indicada';
  end if;

  if new.estado <> old.estado then
    if old.estado = 'borrador' and new.estado = 'publicada' then
      if not exists (select 1 from academico.malla_asignatura ma where ma.malla_id = new.id) then
        raise exception 'No se puede publicar una malla sin asignaturas';
      end if;
      new.publicada_at := now();
    elsif old.estado = 'publicada' and new.estado = 'archivada' then
      new.archivada_at := now();
    else
      raise exception 'Transicion de estado no permitida: % -> %', old.estado, new.estado;
    end if;
  end if;
  return new;
end;
$$;

create trigger malla_curricular_controlar
  before insert or update or delete on academico.malla_curricular
  for each row execute function academico.controlar_malla();

-- La composicion de una malla solo se edita mientras es borrador.
create function academico.controlar_malla_asignatura()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
  v_duracion integer;
  v_malla uuid := case when tg_op = 'DELETE' then old.malla_id else new.malla_id end;
begin
  select m.estado, m.duracion_semestres into v_estado, v_duracion
  from academico.malla_curricular m
  where m.id = v_malla;

  if v_estado is not null and v_estado <> 'borrador' then
    raise exception 'La malla no esta en borrador; no se puede modificar su composicion';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE' and (new.malla_id <> old.malla_id or new.asignatura_id <> old.asignatura_id) then
    raise exception 'No se puede mover una asignatura a otra malla; elimine y vuelva a agregar';
  end if;

  if new.semestre > v_duracion then
    raise exception 'El semestre % supera la duracion de la malla (% semestres)', new.semestre, v_duracion;
  end if;
  return new;
end;
$$;

create trigger malla_asignatura_controlar
  before insert or update or delete on academico.malla_asignatura
  for each row execute function academico.controlar_malla_asignatura();

-- Un prerrequisito debe estar en un semestre anterior; una correlativa, en el mismo o anterior.
-- Esto tambien evita ciclos de prerrequisitos.
create function academico.controlar_malla_relacion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_estado text;
  v_sem_asig integer;
  v_sem_rel integer;
  v_malla uuid := case when tg_op = 'DELETE' then old.malla_id else new.malla_id end;
begin
  select m.estado into v_estado
  from academico.malla_curricular m
  where m.id = v_malla;

  if v_estado is not null and v_estado <> 'borrador' then
    raise exception 'La malla no esta en borrador; no se pueden modificar sus relaciones';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  select ma.semestre into v_sem_asig
  from academico.malla_asignatura ma
  where ma.malla_id = new.malla_id and ma.asignatura_id = new.asignatura_id;
  select ma.semestre into v_sem_rel
  from academico.malla_asignatura ma
  where ma.malla_id = new.malla_id and ma.asignatura_id = new.relacionada_id;

  if new.tipo = 'prerrequisito' and v_sem_rel >= v_sem_asig then
    raise exception 'Un prerrequisito debe estar en un semestre anterior (% vs %)', v_sem_rel, v_sem_asig;
  elsif new.tipo = 'correlativa' and v_sem_rel > v_sem_asig then
    raise exception 'Una correlativa no puede estar en un semestre posterior (% vs %)', v_sem_rel, v_sem_asig;
  end if;
  return new;
end;
$$;

create trigger malla_relacion_controlar
  before insert or update or delete on academico.malla_relacion
  for each row execute function academico.controlar_malla_relacion();

-- Al cambiar el semestre de una asignatura no se pueden romper sus relaciones.
create function academico.revalidar_relaciones_malla()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.semestre <> old.semestre and exists (
    select 1
    from academico.malla_relacion r
    join academico.malla_asignatura a
      on a.malla_id = r.malla_id and a.asignatura_id = r.asignatura_id
    join academico.malla_asignatura b
      on b.malla_id = r.malla_id and b.asignatura_id = r.relacionada_id
    where r.malla_id = new.malla_id
      and ((r.tipo = 'prerrequisito' and b.semestre >= a.semestre)
        or (r.tipo = 'correlativa' and b.semestre > a.semestre))
  ) then
    raise exception 'El cambio de semestre contradice un prerrequisito o correlativa de la malla';
  end if;
  return null;
end;
$$;

create trigger malla_asignatura_revalidar
  after update of semestre on academico.malla_asignatura
  for each row execute function academico.revalidar_relaciones_malla();

-- La equivalencia es simetrica: se guarda una sola vez con el par ordenado.
create function academico.ordenar_equivalencia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tmp uuid;
begin
  if new.asignatura_id > new.equivalente_id then
    v_tmp := new.asignatura_id;
    new.asignatura_id := new.equivalente_id;
    new.equivalente_id := v_tmp;
  end if;
  return new;
end;
$$;

create trigger asignatura_equivalencia_ordenar
  before insert or update on academico.asignatura_equivalencia
  for each row execute function academico.ordenar_equivalencia();

-- Una promocion solo puede asociarse a una malla publicada.
create function academico.controlar_promocion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.malla_id <> old.malla_id) and not exists (
    select 1 from academico.malla_curricular m
    where m.id = new.malla_id and m.estado = 'publicada'
  ) then
    raise exception 'La promocion solo puede asociarse a una malla publicada';
  end if;
  return new;
end;
$$;

create trigger promocion_controlar before insert or update on academico.promocion
  for each row execute function academico.controlar_promocion();

-- Vigencia de la promocion: anio de ingreso + duracion de la carrera (en anios
-- completos) + anios de gracia. Ej.: ingreso 2023, 8 semestres, 3 de gracia
-- -> fin regular 2026, vigente hasta 2029.
create view academico.v_promocion with (security_invoker = true) as
select
  p.id,
  p.carrera_id,
  p.anio,
  p.malla_id,
  m.version as malla_version,
  m.duracion_semestres,
  p.anios_gracia,
  p.anio + ceil(m.duracion_semestres / 2.0)::integer - 1 as anio_fin_regular,
  p.anio + ceil(m.duracion_semestres / 2.0)::integer - 1 + p.anios_gracia as anio_fin_vigencia,
  extract(year from current_date)::integer
    <= p.anio + ceil(m.duracion_semestres / 2.0)::integer - 1 + p.anios_gracia as vigente
from academico.promocion p
join academico.malla_curricular m on m.id = p.malla_id;

-- ------------------------------------------------------- permisos y roles

insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r cross join seguridad.permiso p
where r.nombre = 'administrador'
on conflict do nothing;

insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p on p.modulo = 'academico'
where r.nombre = 'direccion_academica'
on conflict do nothing;

insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p
  on p.codigo in ('promociones.leer', 'promociones.gestionar')
where r.nombre = 'coordinador_carrera'
on conflict do nothing;

insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r join seguridad.permiso p on p.codigo = 'promociones.leer'
where r.nombre in ('secretaria_academica', 'consulta')
on conflict do nothing;

-- -------------------------------------------------------------------- RLS

alter table academico.malla_curricular enable row level security;
alter table academico.malla_asignatura enable row level security;
alter table academico.malla_relacion enable row level security;
alter table academico.asignatura_equivalencia enable row level security;
alter table academico.promocion enable row level security;

grant select, insert, update, delete on
  academico.malla_curricular, academico.malla_asignatura, academico.malla_relacion,
  academico.asignatura_equivalencia, academico.promocion
  to authenticated;
grant select on academico.v_promocion to authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('malla_curricular',        'mallas.leer',      'mallas.gestionar'),
      ('malla_asignatura',        'mallas.leer',      'mallas.gestionar'),
      ('malla_relacion',          'mallas.leer',      'mallas.gestionar'),
      ('asignatura_equivalencia', 'asignaturas.leer', 'asignaturas.gestionar'),
      ('promocion',               'promociones.leer', 'promociones.gestionar')
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
