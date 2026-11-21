/**
 * Manual de usuario dentro de la aplicación (requisito F1 del Acta).
 *
 * Se abre con la tecla F1 o con el botón de ayuda de la cabecera. Si se llega desde una
 * pantalla concreta (`?desde=/academico/carreras`), se resalta y se desplaza hasta la
 * sección que corresponde. El mismo contenido está en Docs/Manual_de_Usuario.md.
 */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

interface Seccion {
  id: string;
  titulo: string;
  /** Rutas de la aplicación a las que aplica esta sección (para la ayuda contextual). */
  rutas: string[];
  texto: string[];
}

const secciones: Seccion[] = [
  {
    id: "ingreso",
    titulo: "Ingreso y navegación",
    rutas: ["/", "/academico", "/seguridad", "/reportes"],
    texto: [
      "Inicie sesión con su correo y contraseña. Si la primera vez aparece un error de sesión, use «Reintentar».",
      "El menú lateral agrupa los módulos en Académico, Seguridad y Reportes; solo ve los módulos para los que su rol tiene permiso. El botón de la cabecera contrae el menú y el sol/luna cambia entre modo claro y oscuro.",
      "Pase el cursor sobre su avatar para ver sus roles. F1 abre este manual en la sección de la pantalla actual.",
    ],
  },
  {
    id: "facultades",
    titulo: "Facultades",
    rutas: ["/academico/facultades"],
    texto: [
      "Use «Nueva facultad» para registrar código y nombre; el lápiz edita y la papelera elimina.",
      "Una facultad con carreras asociadas no se puede eliminar: desmarque «Activa» para darla de baja sin perder el historial.",
    ],
  },
  {
    id: "carreras",
    titulo: "Carreras",
    rutas: ["/academico/carreras"],
    texto: [
      "Cada carrera pertenece a una facultad y tiene código, nombre, duración en semestres (1 a 20) y título opcional.",
      "Solo se puede eliminar una carrera sin mallas ni promociones; en otro caso desmárquela como «Activa».",
    ],
  },
  {
    id: "asignaturas",
    titulo: "Asignaturas",
    rutas: ["/academico/asignaturas"],
    texto: [
      "El catálogo contiene cada materia una sola vez, con código único, carga horaria total y, opcionalmente, horas teóricas y prácticas. La suma de teóricas y prácticas no puede superar la carga horaria total.",
      "El estado (activa, inactiva o en revisión) permite retirar una materia sin borrarla. Una asignatura incluida en alguna malla no se puede eliminar.",
    ],
  },
  {
    id: "equivalencias",
    titulo: "Equivalencias",
    rutas: ["/academico/equivalencias"],
    texto: [
      "Registre pares de asignaturas equivalentes eligiendo ambas en la lista. La relación es simétrica y no puede repetirse ni relacionar una asignatura consigo misma.",
      "El lápiz edita la observación del par; la papelera lo elimina.",
    ],
  },
  {
    id: "mallas",
    titulo: "Mallas curriculares",
    rutas: ["/academico/mallas"],
    texto: [
      "Cree una malla indicando carrera, nombre, resolución, duración y horas por crédito. Se abre vacía en estado borrador: agregue asignaturas por semestre y defina sus prerrequisitos.",
      "Publique la malla cuando esté lista; una malla publicada ya no se edita. Para modificarla use «Nueva versión», que crea una copia en borrador. Las versiones antiguas se archivan.",
      "Solo los borradores se pueden eliminar.",
    ],
  },
  {
    id: "prerrequisitos",
    titulo: "Prerrequisitos",
    rutas: ["/academico/correlatividades"],
    texto: [
      "Muestra, para la malla elegida, qué asignaturas exige cada materia. Los prerrequisitos se editan en el detalle de la malla, al agregar o editar cada materia.",
    ],
  },
  {
    id: "promociones",
    titulo: "Promociones",
    rutas: ["/academico/promociones"],
    texto: [
      "Una promoción es la cohorte de ingreso de una carrera en un año y se asocia a una malla publicada de esa carrera.",
      "La vigencia se calcula sola: año de ingreso + duración de la malla + años de gracia. La carrera y el año no se editan; si se cargaron mal, elimine la promoción y créela de nuevo.",
    ],
  },
  {
    id: "usuarios",
    titulo: "Usuarios, roles y permisos",
    rutas: ["/seguridad/usuarios", "/seguridad/roles"],
    texto: [
      "Los administradores crean usuarios, les asignan roles y los activan o desactivan. Cada rol agrupa permisos; los roles de sistema no se pueden borrar.",
      "Nunca comparta su contraseña. Un usuario inactivo no puede ingresar.",
    ],
  },
  {
    id: "reportes",
    titulo: "Reportes",
    rutas: ["/reportes/malla", "/reportes/promociones"],
    texto: [
      "«Malla por carrera»: elija carrera y versión para ver el plan por semestre con horas, créditos y prerrequisitos; «Descargar PDF» genera el documento.",
      "«Vigencia de promociones»: lista cada promoción con su malla y el año hasta el que está vigente; puede filtrar por carrera o ver solo las vigentes.",
    ],
  },
];

export default function Ayuda() {
  const [params] = useSearchParams();
  const desde = params.get("desde") ?? "/";
  // La sección activa es la de la ruta más específica que coincida con la pantalla de origen.
  const activa = secciones.find((s) => s.rutas.includes(desde))?.id ?? "ingreso";

  useEffect(() => {
    document.getElementById(`ayuda-${activa}`)?.scrollIntoView({ block: "start" });
  }, [activa]);

  return (
    <>
      <div className="page-head">
        <h1>Manual de usuario</h1>
        <Link className="btn" to={desde}>
          Volver
        </Link>
      </div>
      <p className="muted">
        Resumen de uso de cada módulo. Presione F1 en cualquier pantalla para abrir la sección
        correspondiente.
      </p>
      {secciones.map((s) => (
        <section
          key={s.id}
          id={`ayuda-${s.id}`}
          className="card"
          style={{
            marginBottom: 16,
            padding: 20,
            borderColor: s.id === activa ? "var(--primary)" : undefined,
          }}
        >
          <h2>{s.titulo}</h2>
          {s.texto.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </section>
      ))}
    </>
  );
}
