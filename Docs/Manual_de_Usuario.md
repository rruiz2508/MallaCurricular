# Manual de usuario — Sistema de Gestión de Malla Curricular

Resumen de uso de cada módulo. Dentro de la aplicación se abre con **F1** (o el botón de ayuda de la cabecera) en la sección de la pantalla actual.

## Ingreso y navegación

Inicie sesión con su correo y contraseña. Si la primera vez aparece un error de sesión, use «Reintentar».

El menú lateral agrupa los módulos en Académico, Seguridad y Reportes; solo ve los módulos para los que su rol tiene permiso. El botón de la cabecera contrae el menú y el sol/luna cambia entre modo claro y oscuro.

Pase el cursor sobre su avatar para ver sus roles. F1 abre este manual en la sección de la pantalla actual.

## Facultades

Use «Nueva facultad» para registrar código y nombre; el lápiz edita y la papelera elimina.

Una facultad con carreras asociadas no se puede eliminar: desmarque «Activa» para darla de baja sin perder el historial.

## Carreras

Cada carrera pertenece a una facultad y tiene código, nombre, duración en semestres (1 a 20) y título opcional.

Solo se puede eliminar una carrera sin mallas ni promociones; en otro caso desmárquela como «Activa».

## Asignaturas

El catálogo contiene cada materia una sola vez, con código único, carga horaria total y, opcionalmente, horas teóricas y prácticas. La suma de teóricas y prácticas no puede superar la carga horaria total.

El estado (activa, inactiva o en revisión) permite retirar una materia sin borrarla. Una asignatura incluida en alguna malla no se puede eliminar.

## Equivalencias

Registre pares de asignaturas equivalentes eligiendo ambas en la lista. La relación es simétrica y no puede repetirse ni relacionar una asignatura consigo misma.

El lápiz edita la observación del par; la papelera lo elimina.

## Mallas curriculares

Cree una malla indicando carrera, nombre, resolución, duración y horas por crédito. Se abre vacía en estado borrador: agregue asignaturas por semestre y defina sus prerrequisitos.

Publique la malla cuando esté lista; una malla publicada ya no se edita. Para modificarla use «Nueva versión», que crea una copia en borrador. Las versiones antiguas se archivan.

Solo los borradores se pueden eliminar.

## Prerrequisitos

Muestra, para la malla elegida, qué asignaturas exige cada materia. Los prerrequisitos se editan en el detalle de la malla, al agregar o editar cada materia.

## Promociones

Una promoción es la cohorte de ingreso de una carrera en un año y se asocia a una malla publicada de esa carrera.

La vigencia se calcula sola: año de ingreso + duración de la malla + años de gracia. La carrera y el año no se editan; si se cargaron mal, elimine la promoción y créela de nuevo.

## Usuarios, roles y permisos

Los administradores crean usuarios, les asignan roles y los activan o desactivan. Cada rol agrupa permisos; los roles de sistema no se pueden borrar.

Nunca comparta su contraseña. Un usuario inactivo no puede ingresar.

## Reportes

«Malla por carrera»: elija carrera y versión para ver el plan por semestre con horas, créditos y prerrequisitos; «Descargar PDF» genera el documento.

«Vigencia de promociones»: lista cada promoción con su malla y el año hasta el que está vigente; puede filtrar por carrera o ver solo las vigentes.
