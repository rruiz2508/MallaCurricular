-- Prerrequisito y correlativa comparten la misma regla: no se puede cursar una
-- asignatura sin haber cursado y aprobado la relacionada, que por lo tanto debe
-- estar en un semestre anterior (ej.: Ingles 2 requiere Ingles 1 aprobada).
-- Se conservan ambos tipos como etiqueta; la regla ya no los distingue.

create or replace function academico.controlar_malla_relacion()
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

  if v_sem_rel >= v_sem_asig then
    raise exception 'La asignatura requerida debe estar en un semestre anterior (% vs %)', v_sem_rel, v_sem_asig;
  end if;
  return new;
end;
$$;

create or replace function academico.revalidar_relaciones_malla()
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
      and b.semestre >= a.semestre
  ) then
    raise exception 'El cambio de semestre contradice un prerrequisito o correlativa de la malla';
  end if;
  return null;
end;
$$;
