import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

import { estadoMallaBadge } from "./types";
import type { MallaDetalle, TipoMateria } from "./types";

const tipos: Record<TipoMateria, string> = {
  obligatoria: "Obligatoria",
  electiva: "Electiva",
  complementaria: "Complementaria",
  trabajo_final: "Trabajo final",
};

const formato = new Intl.NumberFormat("es-PY", { maximumFractionDigits: 2 });

export function generarPdfMalla(malla: MallaDetalle): jsPDF {
  const pdf = new jsPDF({ orientation: "landscape", format: "a4", compress: true });
  const ancho = pdf.internal.pageSize.getWidth();
  const margen = 14;
  const asignaturas = [...malla.asignaturas].sort(
    (a, b) =>
      (a.semestre ?? Infinity) - (b.semestre ?? Infinity) ||
      (a.orden ?? Infinity) - (b.orden ?? Infinity) ||
      a.codigo.localeCompare(b.codigo, "es"),
  );
  const totales = asignaturas.reduce(
    (suma, materia) => ({
      teoricos: suma.teoricos + materia.creditos_teoricos,
      practicos: suma.practicos + materia.creditos_practicos,
      horas: suma.horas + materia.horas,
    }),
    { teoricos: 0, practicos: 0, horas: 0 },
  );

  pdf.setProperties({ title: `${malla.nombre} - versión ${malla.version}` });
  pdf.setFontSize(11);
  pdf.setTextColor(49, 63, 82);
  pdf.text("Universidad Autónoma de Asunción", margen, 15);
  pdf.setFontSize(20);
  pdf.setTextColor(19, 34, 55);
  const titulo: string[] = pdf.splitTextToSize(malla.nombre, ancho - 2 * margen);
  pdf.text(titulo, margen, 25);
  pdf.setFontSize(10);
  const metadatos: string[] = pdf.splitTextToSize(
    [
      `${malla.carrera_codigo} - ${malla.carrera}`,
      `Versión ${malla.version} - ${estadoMallaBadge[malla.estado].texto}`,
      `${malla.duracion_semestres} semestres - ${formato.format(malla.horas_por_credito)} horas por crédito`,
      malla.resolucion ? `Resolución ${malla.resolucion}` : null,
    ].filter(Boolean).join("  |  "),
    ancho - 2 * margen,
  );
  const y = 25 + titulo.length * 8;
  pdf.text(metadatos, margen, y);

  autoTable(pdf, {
    startY: y + metadatos.length * 5 + 2,
    margin: { top: 14, bottom: 16, left: margen, right: margen },
    head: [["Semestre", "Código", "Cód. sistema", "Asignatura", "Tipo", "Horas", "Créd. T.", "Créd. P.", "Prerrequisitos"]],
    body: asignaturas.length
      ? asignaturas.map((a) => [
          a.semestre?.toString() ?? "Sin semestre",
          a.codigo,
          a.codigo_sistema ?? "–",
          a.nombre,
          tipos[a.tipo],
          formato.format(a.horas),
          formato.format(a.creditos_teoricos),
          formato.format(a.creditos_practicos),
          a.prerrequisitos.map((relacion) => relacion.codigo).join(", ") || "–",
        ])
      : [[{ content: "Esta malla aún no tiene asignaturas.", colSpan: 9 }]],
    foot: [[
      { content: `Total · ${asignaturas.length} asignaturas`, colSpan: 5 },
      formato.format(totales.horas),
      formato.format(totales.teoricos),
      formato.format(totales.practicos),
      "",
    ]],
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    styles: { fontSize: 9, cellPadding: 2.2, overflow: "linebreak" },
    headStyles: { fillColor: [27, 49, 78] },
    footStyles: { fillColor: [27, 49, 78] },
    columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
  });

  const paginas = pdf.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina++) {
    pdf.setPage(pagina);
    pdf.setFontSize(9);
    pdf.setTextColor(85, 99, 119);
    pdf.text(`Página ${pagina} de ${paginas}`, ancho - margen, 201, { align: "right" });
  }
  return pdf;
}

export function descargarPdfMalla(malla: MallaDetalle): void {
  const codigo = malla.carrera_codigo.replace(/[^a-zA-Z0-9_-]+/g, "-") || "curricular";
  generarPdfMalla(malla).save(`malla-${codigo}-v${malla.version}.pdf`);
}
