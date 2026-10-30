-- Datos de prueba: Licenciatura en Ciencias Informaticas con Enfasis en Sistemas
-- Informaticos (LCI-SI), curriculum propuesto de la promocion 2023.
-- Fuente: Docs/Curriculum_Propuesto_2023 - LCI-SI_Ruiz_Robert.pdf
--
-- Requiere las migraciones aplicadas y la facultad "Facultad de Ciencias y Tecnologia"
-- ya creada. Se ejecuta una sola vez (las claves unicas impiden duplicarlo).
-- Notas sobre los datos:
--   * Los creditos del PDF se guardan como horas (creditos x 15, ver horas_por_credito).
--   * "Participacion en congresos y seminarios" no tiene codigo en el PDF; se le asigna
--     COMP-001 porque el catalogo exige uno.
--   * El prerrequisito de INFO-300 figura en el PDF como "INF0-120" (con cero): se
--     interpreto como INFO-120.
--   * El orden de las filas dentro de cada semestre es el del PDF (columna orden).

insert into academico.carrera (facultad_id, codigo, nombre, titulo_otorgado, duracion_semestres)
select f.id, 'LCI-SI',
       'Licenciatura en Ciencias Informáticas con Énfasis en Sistemas Informáticos',
       null, 8
from academico.facultad f
where f.nombre in ('Facultad de Ciencias y Tecnología', 'Facultad de Ciencias y Tecnologia');

insert into academico.asignatura (codigo, codigo_sistema, nombre, carga_horaria_total, horas_teoricas, horas_practicas) values
  ('INFO-110', '3170', 'INTRODUCCIÓN A LAS TECNOLOGÍAS DE INFORMACIÓN Y LA COMUNICACIÓN', 60, 60, 0),
  ('INFO-120', '260', 'INTRODUCCIÓN A LA INFORMÁTICA', 60, 60, 0),
  ('INFO-181', '2445', 'INTRODUCCIÓN AL DISEÑO Y CONSTRUCCIÓN DE PÁGINAS WEB', 120, 60, 60),
  ('LMO-106', '1377', 'COMUNICACIÓN: ORAL Y ESCRITA', 60, 60, 0),
  ('INFO-150', '1016', 'LÓGICA DE PROGRAMACIÓN DE COMPUTADORAS I', 120, 60, 60),
  ('INFO-178', '1539', 'TALLER DE SISTEMAS OPERATIVOS MULTIUSUARIO - LINUX', 120, 60, 60),
  ('LMO-110', '1706', 'INGLÉS PARA INFORMÁTICA I', 60, 60, 0),
  ('MAT-100', '1005', 'ÁLGEBRA', 60, 60, 0),
  ('INFO-162', '1540', 'INTRODUCCIÓN A LA PROGRAMACIÓN ORIENTADA POR OBJETOS - JAVA', 120, 60, 60),
  ('INFO-200', '1029', 'LÓGICA DE PROGRAMACIÓN DE COMPUTADORAS II', 120, 60, 60),
  ('LMO-210', '2077', 'INGLÉS PARA INFORMÁTICA II', 60, 60, 0),
  ('MAT-153', '2431', 'MATEMÁTICAS DISCRETAS', 60, 60, 0),
  ('INFO-270', '41', 'ESTRUCTURAS DE DATOS Y ARCHIVOS', 60, 60, 0),
  ('INFO-173', '3352', 'INTRODUCCIÓN A LA PROGRAMACIÓN ORIENTADA POR OBJETOS - C#', 120, 60, 60),
  ('INFO-242', '1542', 'PROGRAMACIÓN ORIENTADA POR OBJETOS AVANZADA - JAVA', 120, 60, 60),
  ('INFO-155', '1545', 'INTRODUCCIÓN A LA COMUNICACIÓN DE DATOS', 60, 60, 0),
  ('INFO-189', '1552', 'FUNDAMENTOS DE LAS CIENCIAS DE COMPUTACIÓN', 60, 60, 0),
  ('INFO-325', '3065', 'ANÁLISIS Y DISEÑO DE SISTEMAS INFORMÁTICOS I', 60, 60, 0),
  ('INFO-176', '4643', 'INTRODUCCIÓN A LA PROGRAMACIÓN PARA DISPOSITIVOS MÓVILES', 120, 60, 60),
  ('INFO-253', '3436', 'PROGRAMACIÓN ORIENTADA POR OBJETOS AVANZADA - C#', 120, 60, 60),
  ('INFO-300', '568', 'GESTIÓN DE PROYECTOS INFORMÁTICOS', 60, 60, 0),
  ('INFO-335', '3066', 'ANÁLISIS Y DISEÑO DE SISTEMAS INFORMÁTICOS II', 60, 60, 0),
  ('INFO-351', '1705', 'DISEÑO DE BASES DE DATOS RELACIONALES', 60, 60, 0),
  ('INFO-256', '4645', 'PROGRAMACIÓN AVANZADA PARA DISPOSITIVOS MÓVILES', 120, 60, 60),
  ('MAT-250', '1022', 'ESTADISTICA DESCRIPTIVA E INFERENCIAL', 60, 60, 0),
  ('INFO-345', '3067', 'ANÁLISIS Y DISEÑO DE SISTEMAS INFORMÁTICOS III', 60, 60, 0),
  ('INFO-510', '1855', 'CALIDAD DEL SOFTWARE', 60, 60, 0),
  ('INFO-411', '1812', 'PROGRAMACIÓN SQL', 120, 60, 60),
  ('MAT-326', '4524', 'FUNDAMENTOS DE CÁLCULO DIFERENCIAL E INTEGRAL', 30, 30, 0),
  ('MAT-327', '4525', 'FUNDAMENTOS DE ÁLGEBRA LINEAL', 30, 30, 0),
  ('ECON-100', '4434', 'FUNDAMENTOS DE ECONOMÍA', 30, 30, 0),
  ('ADM-100', '4435', 'FUNDAMENTOS DE ORGANIZACIÓN EMPRESARIAL', 30, 30, 0),
  ('MAT-280', '538', 'MATEMÁTICA FINANCIERA', 60, 60, 0),
  ('INFO-386', '4886', 'INTERACCIÓN HUMANO-COMPUTADORA', 60, 60, 0),
  ('INFO-431', '4887', 'GESTIÓN DE RIESGOS Y AUDITORÍA DE LAS TICS', 60, 60, 0),
  ('INFO-515', '4436', 'COMPUTACIÓN Y SOCIEDAD', 30, 30, 0),
  ('INFO-525', '4437', 'PRÁCTICA PROFESIONAL DE LA COMPUTACIÓN', 30, 30, 0),
  ('SOC-164', '4433', 'METODOLOGÍA DE LA INVESTIGACIÓN TECNOLÓGICA', 60, 60, 0),
  ('LMO-211', '4610', 'GUARANÍ PARA INFORMÁTICOS', 30, 30, 0),
  ('COMP-001', null, 'PARTICIPACIÓN EN CONGRESOS Y SEMINARIOS', 120, 120, 0),
  ('INFO-587', '4528', 'TRABAJO DE GRADO PARA CIENCIAS INFORMÁTICAS ÉNFASIS SISTEMAS INFORMÁTICOS', 420, 60, 360);

insert into academico.malla_curricular (carrera_id, nombre, resolucion, duracion_semestres)
select c.id, 'Currículum Propuesto - Promoción 23', null, 8
from academico.carrera c where c.codigo = 'LCI-SI';

insert into academico.malla_asignatura (malla_id, asignatura_id, semestre, tipo, orden)
select m.id, a.id, v.semestre, v.tipo, v.orden
from (values
  ('INFO-110', 1::integer, 'obligatoria', 0),
  ('INFO-120', 1::integer, 'obligatoria', 1),
  ('INFO-181', 1::integer, 'obligatoria', 2),
  ('LMO-106', 1::integer, 'obligatoria', 3),
  ('INFO-150', 2::integer, 'obligatoria', 4),
  ('INFO-178', 2::integer, 'obligatoria', 5),
  ('LMO-110', 2::integer, 'obligatoria', 6),
  ('MAT-100', 2::integer, 'obligatoria', 7),
  ('INFO-162', 3::integer, 'obligatoria', 8),
  ('INFO-200', 3::integer, 'obligatoria', 9),
  ('LMO-210', 3::integer, 'obligatoria', 10),
  ('MAT-153', 3::integer, 'obligatoria', 11),
  ('INFO-270', 4::integer, 'obligatoria', 12),
  ('INFO-173', 4::integer, 'obligatoria', 13),
  ('INFO-242', 4::integer, 'obligatoria', 14),
  ('INFO-155', 4::integer, 'obligatoria', 15),
  ('INFO-189', 5::integer, 'obligatoria', 16),
  ('INFO-325', 5::integer, 'obligatoria', 17),
  ('INFO-176', 5::integer, 'obligatoria', 18),
  ('INFO-253', 5::integer, 'obligatoria', 19),
  ('INFO-300', 6::integer, 'obligatoria', 20),
  ('INFO-335', 6::integer, 'obligatoria', 21),
  ('INFO-351', 6::integer, 'obligatoria', 22),
  ('INFO-256', 6::integer, 'obligatoria', 23),
  ('MAT-250', 6::integer, 'obligatoria', 24),
  ('INFO-345', 7::integer, 'obligatoria', 25),
  ('INFO-510', 7::integer, 'obligatoria', 26),
  ('INFO-411', 7::integer, 'obligatoria', 27),
  ('MAT-326', 7::integer, 'obligatoria', 28),
  ('MAT-327', 7::integer, 'obligatoria', 29),
  ('ECON-100', 7::integer, 'obligatoria', 30),
  ('ADM-100', 7::integer, 'obligatoria', 31),
  ('MAT-280', 8::integer, 'obligatoria', 32),
  ('INFO-386', 8::integer, 'obligatoria', 33),
  ('INFO-431', 8::integer, 'obligatoria', 34),
  ('INFO-515', 8::integer, 'obligatoria', 35),
  ('INFO-525', 8::integer, 'obligatoria', 36),
  ('SOC-164', 8::integer, 'obligatoria', 37),
  ('LMO-211', 8::integer, 'obligatoria', 38),
  ('COMP-001', null::integer, 'complementaria', 39),
  ('INFO-587', null::integer, 'trabajo_final', 40)
) as v(codigo, semestre, tipo, orden)
join academico.asignatura a on a.codigo = v.codigo
cross join (
  select mc.id from academico.malla_curricular mc
  join academico.carrera c on c.id = mc.carrera_id
  where c.codigo = 'LCI-SI' and mc.version = 1
) m;

insert into academico.malla_relacion (malla_id, asignatura_id, relacionada_id, tipo)
select m.id, a.id, r.id, 'prerrequisito'
from (values
  ('INFO-150', 'INFO-120'),
  ('INFO-162', 'INFO-150'),
  ('INFO-200', 'INFO-150'),
  ('LMO-210', 'LMO-110'),
  ('MAT-153', 'MAT-100'),
  ('INFO-270', 'INFO-200'),
  ('INFO-173', 'INFO-150'),
  ('INFO-242', 'INFO-200'),
  ('INFO-242', 'INFO-162'),
  ('INFO-155', 'INFO-120'),
  ('INFO-189', 'INFO-200'),
  ('INFO-325', 'INFO-120'),
  ('INFO-176', 'INFO-150'),
  ('INFO-253', 'INFO-200'),
  ('INFO-253', 'INFO-173'),
  ('INFO-300', 'INFO-120'),
  ('INFO-335', 'INFO-325'),
  ('INFO-351', 'INFO-270'),
  ('INFO-256', 'INFO-200'),
  ('INFO-256', 'INFO-176'),
  ('MAT-250', 'MAT-100'),
  ('INFO-345', 'INFO-335'),
  ('INFO-510', 'INFO-300'),
  ('INFO-411', 'INFO-351'),
  ('MAT-326', 'MAT-100'),
  ('MAT-327', 'MAT-100'),
  ('MAT-280', 'MAT-100'),
  ('INFO-386', 'INFO-300'),
  ('INFO-386', 'INFO-325'),
  ('INFO-431', 'INFO-300')
) as v(codigo, requerida)
join academico.asignatura a on a.codigo = v.codigo
join academico.asignatura r on r.codigo = v.requerida
cross join (
  select mc.id from academico.malla_curricular mc
  join academico.carrera c on c.id = mc.carrera_id
  where c.codigo = 'LCI-SI' and mc.version = 1
) m;

update academico.malla_curricular mc set estado = 'publicada'
from academico.carrera c
where c.id = mc.carrera_id and c.codigo = 'LCI-SI' and mc.version = 1;

insert into academico.promocion (carrera_id, anio, malla_id)
select c.id, 2023, mc.id
from academico.carrera c
join academico.malla_curricular mc on mc.carrera_id = c.id and mc.version = 1
where c.codigo = 'LCI-SI';
