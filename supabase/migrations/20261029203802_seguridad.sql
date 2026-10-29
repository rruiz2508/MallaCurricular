-- Incremento 1: modulo de seguridad (usuarios, roles configurables y permisos).
-- Los roles base se marcan como es_sistema (no se pueden borrar ni renombrar);
-- se pueden crear roles adicionales y asignarles cualquier conjunto de permisos.
-- La autorizacion principal se valida en el backend; las politicas RLS son un
-- control complementario.

create schema if not exists seguridad;

create or replace function seguridad.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- tablas

create table seguridad.permiso (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  modulo text not null,
  descripcion text not null
);

create table seguridad.rol (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  es_sistema boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table seguridad.rol_permiso (
  rol_id uuid not null references seguridad.rol (id) on delete cascade,
  permiso_id uuid not null references seguridad.permiso (id) on delete cascade,
  primary key (rol_id, permiso_id)
);
create index rol_permiso_permiso_id_idx on seguridad.rol_permiso (permiso_id);

create table seguridad.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nombre text not null default '',
  apellido text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table seguridad.usuario_rol (
  usuario_id uuid not null references seguridad.usuario (id) on delete cascade,
  rol_id uuid not null references seguridad.rol (id) on delete restrict,
  primary key (usuario_id, rol_id)
);
create index usuario_rol_rol_id_idx on seguridad.usuario_rol (rol_id);

create trigger rol_set_updated_at before update on seguridad.rol
  for each row execute function seguridad.set_updated_at();
create trigger usuario_set_updated_at before update on seguridad.usuario
  for each row execute function seguridad.set_updated_at();

-- ------------------------------------------------- protecciones de roles base

create function seguridad.proteger_rol_sistema()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.es_sistema then
      raise exception 'El rol de sistema "%" no se puede eliminar', old.nombre;
    end if;
    return old;
  end if;

  if old.es_sistema and (new.nombre <> old.nombre or not new.es_sistema) then
    raise exception 'El rol de sistema "%" no se puede renombrar ni dejar de ser de sistema', old.nombre;
  end if;
  if old.nombre = 'administrador' and not new.activo then
    raise exception 'El rol "administrador" no se puede desactivar';
  end if;
  return new;
end;
$$;

create trigger rol_proteger_sistema before update or delete on seguridad.rol
  for each row execute function seguridad.proteger_rol_sistema();

-- El rol administrador conserva siempre sus permisos para evitar quedar sin acceso.
create function seguridad.proteger_permisos_administrador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from seguridad.rol r
    where r.id = old.rol_id and r.nombre = 'administrador'
  ) then
    raise exception 'No se pueden quitar permisos al rol "administrador"';
  end if;
  return old;
end;
$$;

create trigger rol_permiso_proteger_administrador before delete on seguridad.rol_permiso
  for each row execute function seguridad.proteger_permisos_administrador();

-- ------------------------------------------- alta automatica desde Supabase Auth

create function seguridad.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into seguridad.usuario (id, email, nombre, apellido)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', '')
  );
  return new;
end;
$$;
revoke execute on function seguridad.crear_usuario_desde_auth() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function seguridad.crear_usuario_desde_auth();

-- --------------------------------------------------- verificacion de permisos

create function seguridad.tiene_permiso(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from seguridad.usuario u
    join seguridad.usuario_rol ur on ur.usuario_id = u.id
    join seguridad.rol r on r.id = ur.rol_id and r.activo
    join seguridad.rol_permiso rp on rp.rol_id = r.id
    join seguridad.permiso p on p.id = rp.permiso_id
    where u.id = (select auth.uid())
      and u.activo
      and p.codigo = p_codigo
  );
$$;
revoke execute on function seguridad.tiene_permiso(text) from public, anon;
grant execute on function seguridad.tiene_permiso(text) to authenticated;

-- ------------------------------------------------------------- datos base

insert into seguridad.permiso (codigo, modulo, descripcion) values
  ('usuarios.leer',     'seguridad', 'Ver usuarios y sus roles'),
  ('usuarios.gestionar','seguridad', 'Crear, editar, desactivar usuarios y asignar roles'),
  ('roles.leer',        'seguridad', 'Ver roles y permisos'),
  ('roles.gestionar',   'seguridad', 'Crear y editar roles y sus permisos');

insert into seguridad.rol (nombre, descripcion, es_sistema) values
  ('administrador',        'Acceso total al sistema',                                   true),
  ('direccion_academica',  'Autoridades y direccion academica: gestion academica completa', true),
  ('coordinador_carrera',  'Coordinadores o directores de carrera',                     true),
  ('secretaria_academica', 'Mantenimiento de informacion academica',                    true),
  ('consulta',             'Solo lectura (docentes y estudiantes)',                     true);

-- administrador: todos los permisos (los modulos posteriores amplian esta asignacion)
insert into seguridad.rol_permiso (rol_id, permiso_id)
select r.id, p.id
from seguridad.rol r cross join seguridad.permiso p
where r.nombre = 'administrador';

-- -------------------------------------------------------------------- RLS

alter table seguridad.permiso enable row level security;
alter table seguridad.rol enable row level security;
alter table seguridad.rol_permiso enable row level security;
alter table seguridad.usuario enable row level security;
alter table seguridad.usuario_rol enable row level security;

grant usage on schema seguridad to authenticated;
grant select on seguridad.permiso to authenticated;
grant select, insert, update, delete on
  seguridad.rol, seguridad.rol_permiso, seguridad.usuario, seguridad.usuario_rol
  to authenticated;

create policy permiso_select on seguridad.permiso for select to authenticated
  using ((select seguridad.tiene_permiso('roles.leer')));

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('rol',         'roles.leer',    'roles.gestionar'),
      ('rol_permiso', 'roles.leer',    'roles.gestionar'),
      ('usuario',     'usuarios.leer', 'usuarios.gestionar'),
      ('usuario_rol', 'usuarios.leer', 'usuarios.gestionar')
    ) as v(tabla, leer, gestionar)
  loop
    execute format(
      'create policy %I on seguridad.%I for select to authenticated using ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_select', t.tabla, t.leer);
    execute format(
      'create policy %I on seguridad.%I for insert to authenticated with check ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_insert', t.tabla, t.gestionar);
    execute format(
      'create policy %I on seguridad.%I for update to authenticated using ((select seguridad.tiene_permiso(%L))) with check ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_update', t.tabla, t.gestionar, t.gestionar);
    execute format(
      'create policy %I on seguridad.%I for delete to authenticated using ((select seguridad.tiene_permiso(%L)))',
      t.tabla || '_delete', t.tabla, t.gestionar);
  end loop;
end;
$$;

-- Cada usuario puede ver su propio perfil y sus propios roles.
create policy usuario_select_propio on seguridad.usuario for select to authenticated
  using (id = (select auth.uid()));
create policy usuario_rol_select_propio on seguridad.usuario_rol for select to authenticated
  using (usuario_id = (select auth.uid()));
