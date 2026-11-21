-- Autoria del alta de usuarios creados desde la aplicacion.
--
-- GoTrue no escribe app_metadata en el INSERT de auth.users: lo aplica en un UPDATE
-- posterior. Como el trigger del perfil solo escuchaba el INSERT, created_by quedaba
-- siempre en null y la autoria del alta se perdia.
--
-- Ahora el trigger tambien corre en UPDATE y completa created_by cuando el id del creador
-- aparece despues del alta. Solo actua si la columna sigue en null, asi no se puede
-- reescribir una autoria ya registrada.
--
-- Para que esa escritura sobreviva, seguridad.auditar() acepta el paso de created_by de
-- null a un valor (rellenar una autoria vacia) y sigue bloqueando cualquier otro cambio.

create or replace function seguridad.auditar()
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

  if old.created_by is null and new.created_by is not null
     and tg_table_schema = 'seguridad' and tg_table_name = 'usuario' then
    -- Autoria vacia que se completa: es el alta desde Supabase Auth, donde el creador
    -- llega en un update posterior. Una vez registrada ya no cambia. Se limita al perfil
    -- de usuario: en el resto de las tablas created_by sigue siendo inmutable.
    null;
  elsif new.created_by is null
     and old.created_by is not null
     and not exists (select 1 from seguridad.usuario u where u.id = old.created_by) then
    -- created_by pasa a nulo porque el usuario ya no existe (on delete set null).
    new.created_by := null;
  else
    new.created_by := old.created_by;
  end if;

  new.updated_by := case
    when v_usuario is not null
         and exists (select 1 from seguridad.usuario u where u.id = v_usuario) then v_usuario
  end;
  return new;
end;
$$;
revoke execute on function seguridad.auditar() from public, anon, authenticated;

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

  if tg_op = 'INSERT' then
    insert into seguridad.usuario (id, email, nombre, apellido, created_by)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'nombre', ''),
      coalesce(new.raw_user_meta_data ->> 'apellido', ''),
      v_creador
    );
    return new;
  end if;

  if v_creador is not null then
    update seguridad.usuario
    set created_by = v_creador
    where id = new.id
      and created_by is null;
  end if;
  return new;
end;
$$;
revoke execute on function seguridad.crear_usuario_desde_auth() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update on auth.users
  for each row execute function seguridad.crear_usuario_desde_auth();
