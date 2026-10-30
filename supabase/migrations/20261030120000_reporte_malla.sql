-- Reporte de malla curricular por promocion (ver Docs/Curriculum_Propuesto_2023 - ...pdf).
--
-- El reporte lista, por semestre, cada materia con: anio lectivo, codigo del sistema
-- institucional, codigo de materia, nombre, creditos teoricos y practicos, horas y
-- prerrequisitos; mas filas sin semestre (actividades complementarias y trabajo de
-- grado) y una fila de totales.
--
-- Brechas del modelo anterior que cubre esta migracion:
--   * asignatura.codigo_sistema: codigo interno del sistema academico institucional.
--   * malla_curricular.horas_por_credito: los creditos no se guardan, se calculan como
--     horas / horas_por_credito (en el reporte de ejemplo siempre son 15 horas).
--   * malla_asignatura.semestre ahora puede ser nulo para los tipos 'complementaria' y
--     'trabajo_final', que no se cursan en un semestre concreto.
--   * malla_asignatura.orden: orden de presentacion dentro del semestre.
--   * academico.v_reporte_promocion: una fila por materia de la malla de la promocion.

-- ---------------------------------------------------------------- columnas

alter table academico.asignatura
  add column codigo_sistema text unique;

alter table academico.malla_curricular
  add column horas_por_credito integer not null default 15 check (horas_por_credito > 0);

alter table academico.malla_asignatura
  add column orden integer check (orden >= 0);

alter table academico.malla_asignatura alter column semestre drop not null;

alter table academico.malla_asignatura drop constraint malla_asignatura_tipo_check;
alter table academico.malla_asignatura
  add constraint malla_asignatura_tipo_check
    check (tipo in ('obligatoria', 'electiva', 'complementaria', 'trabajo_final'));

-- Solo las materias que se cursan en un semestre llevan semestre.
alter table academico.malla_asignatura
  add constraint malla_asignatura_semestre_segun_tipo
    check ((tipo in ('complementaria', 'trabajo_final')) = (semestre is null));

-- ------------------------------------------------- reglas de consistencia

-- Una asignatura sin semestre (p. ej. el trabajo de grado) puede exigir materias, pero
-- ninguna asignatura puede exigir una que no tenga semestre.
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

  if v_sem_rel is null then
    raise exception 'La asignatura requerida debe cursarse en un semestre';
  end if;
  if v_sem_asig is not null and v_sem_rel >= v_sem_asig then
    raise exception 'La asignatura requerida debe estar en un semestre anterior (% vs %)', v_sem_rel, v_sem_asig;
  end if;
  return new;
end;
$$;

-- Al cambiar el semestre (o quitarlo) no se pueden romper las relaciones existentes.
create or replace function academico.revalidar_relaciones_malla()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.semestre is distinct from old.semestre and exists (
    select 1
    from academico.malla_relacion r
    join academico.malla_asignatura a
      on a.malla_id = r.malla_id and a.asignatura_id = r.asignatura_id
    join academico.malla_asignatura b
      on b.malla_id = r.malla_id and b.asignatura_id = r.relacionada_id
    where r.malla_id = new.malla_id
      and (b.semestre is null or (a.semestre is not null and b.semestre >= a.semestre))
  ) then
    raise exception 'El cambio de semestre contradice un prerrequisito o correlativa de la malla';
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------- el reporte

-- Una fila por materia de la malla asociada a cada promocion. Los datos de cabecera
-- (facultad, carrera, promocion) viajan en cada fila para poder filtrar por promocion.
--   * anio_lectivo: anio de ingreso + semestres transcurridos / 2 (semestres 1-2 ->
--     anio de ingreso, 3-4 -> el siguiente, etc.); nulo si no tiene semestre.
--   * creditos_*: horas / horas_por_credito. Si la asignatura no define horas teoricas,
--     se toman como el total menos las practicas.
--   * prerrequisitos: codigos separados por coma, o 'NINGUNO'.
-- Orden de presentacion: semestre (las filas sin semestre al final), orden y codigo.
create view academico.v_reporte_promocion with (security_invoker = true) as
select
  p.id as promocion_id,
  f.nombre as facultad,
  c.nombre as carrera,
  p.anio as promocion_anio,
  m.id as malla_id,
  m.version as malla_version,
  m.nombre as malla_nombre,
  ma.semestre,
  case when ma.semestre is null then null
       else p.anio + (ma.semestre - 1) / 2 end as anio_lectivo,
  ma.tipo,
  ma.orden,
  a.id as asignatura_id,
  a.codigo_sistema,
  a.codigo,
  a.nombre,
  round(coalesce(a.horas_teoricas, a.carga_horaria_total - coalesce(a.horas_practicas, 0))
        / m.horas_por_credito::numeric, 2) as creditos_teoricos,
  round(coalesce(a.horas_practicas, 0) / m.horas_por_credito::numeric, 2) as creditos_practicos,
  a.carga_horaria_total as horas,
  coalesce(
    (select string_agg(req.codigo, ', ' order by req.codigo)
     from academico.malla_relacion r
     join academico.asignatura req on req.id = r.relacionada_id
     where r.malla_id = ma.malla_id and r.asignatura_id = ma.asignatura_id),
    'NINGUNO') as prerrequisitos
from academico.promocion p
join academico.carrera c on c.id = p.carrera_id
join academico.facultad f on f.id = c.facultad_id
join academico.malla_curricular m on m.id = p.malla_id
join academico.malla_asignatura ma on ma.malla_id = m.id
join academico.asignatura a on a.id = ma.asignatura_id;

grant select on academico.v_reporte_promocion to authenticated;
