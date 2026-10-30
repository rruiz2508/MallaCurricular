-- Auditoria de autoria: cada tabla guarda quien inserto el registro (created_by) y quien
-- lo modifico por ultima vez (updated_by). Ambos referencian a seguridad.usuario.
--
-- Quien rellena las columnas es un trigger (no el cliente), asi que no se pueden
-- falsificar. El usuario se toma, en este orden, de:
--   1. la variable de sesion app.current_user_id, que fija el backend en cada peticion
--      (se conecta con un rol que omite RLS, por lo que auth.uid() es nulo ahi);
--   2. auth.uid(), cuando el acceso es directo con el cliente de Supabase.
-- Sin ninguno de los dos (SQL Editor, migraciones, datos de prueba) quedan en null.
--
-- Los registros existentes antes de esta migracion quedan con created_by/updated_by nulos.

-- ------------------------------------------------------------------ trigger

-- security definer: las comprobaciones de existencia de usuarios no deben depender de lo
-- que RLS le deje ver a quien escribe.
create function seguridad.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := coalesce(
    nullif(current_setting('app.current_user_id', true), '')::uuid,
    (select auth.uid())
  );
begin
  if tg_op = 'INSERT' then
    -- Si hay usuario de sesion manda este; el valor enviado solo se respeta sin sesion
    -- (por ejemplo el alta desde Supabase Auth, que informa quien creo la cuenta).
    new.created_by := coalesce(v_usuario, new.created_by);
    new.updated_by := coalesce(v_usuario, new.created_by);
    return new;
  end if;

  -- created_by no se puede cambiar, salvo que pase a nulo porque el usuario ya no existe:
  -- es la accion "on delete set null" de la clave foranea, que actualiza la fila por dentro.
  if new.created_by is null
     and old.created_by is not null
     and not exists (select 1 from seguridad.usuario u where u.id = old.created_by) then
    new.created_by := null;
  else
    new.created_by := old.created_by;
  end if;

  -- updated_by es el usuario de la sesion; si esa sesion es de un usuario que se esta
  -- borrando, o no hay sesion, queda nulo.
  new.updated_by := case
    when v_usuario is not null
         and exists (select 1 from seguridad.usuario u where u.id = v_usuario) then v_usuario
  end;
  return new;
end;
$$;
revoke execute on function seguridad.auditar() from public, anon, authenticated;

-- ------------------------------------------------- columnas y triggers por tabla

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('seguridad', 'permiso'),
      ('seguridad', 'rol'),
      ('seguridad', 'rol_permiso'),
      ('seguridad', 'usuario'),
      ('seguridad', 'usuario_rol'),
      ('academico', 'facultad'),
      ('academico', 'carrera'),
      ('academico', 'asignatura'),
      ('academico', 'malla_curricular'),
      ('academico', 'malla_asignatura'),
      ('academico', 'malla_relacion'),
      ('academico', 'asignatura_equivalencia'),
      ('academico', 'promocion')
    ) as v(esquema, tabla)
  loop
    -- Si se elimina el usuario, el registro conserva su historia pero pierde la autoria.
    execute format(
      'alter table %I.%I '
      'add column created_by uuid references seguridad.usuario (id) on delete set null, '
      'add column updated_by uuid references seguridad.usuario (id) on delete set null',
      t.esquema, t.tabla);
    execute format(
      'create trigger %I before insert or update on %I.%I '
      'for each row execute function seguridad.auditar()',
      t.tabla || '_auditar', t.esquema, t.tabla);
  end loop;
end;
$$;

-- --------------------------------------- alta de usuarios desde Supabase Auth

-- El perfil se crea en un trigger de auth.users, fuera de la sesion del backend. Para
-- registrar quien dio de alta la cuenta, el backend envia su id en app_metadata (solo
-- escribible con la Admin API; user_metadata podria falsificarlo quien se registre solo).
create or replace function seguridad.crear_usuario_desde_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_creador uuid;
begin
  if (new.raw_app_meta_data ->> 'creado_por') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select u.id into v_creador
    from seguridad.usuario u
    where u.id = (new.raw_app_meta_data ->> 'creado_por')::uuid;
  end if;

  insert into seguridad.usuario (id, email, nombre, apellido, created_by)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    v_creador
  );
  return new;
end;
$$;
