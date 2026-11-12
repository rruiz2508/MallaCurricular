import { useEffect, useState } from "react";

export const tamanosPagina = [10, 25, 50] as const;
type TamanoPagina = (typeof tamanosPagina)[number];

export function usePaginacion<T>(registros: readonly T[]) {
  const [paginaSolicitada, setPagina] = useState(1);
  const [tamano, setTamano] = useState<TamanoPagina>(10);
  const total = registros.length;
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const pagina = Math.min(paginaSolicitada, paginas);
  const inicio = (pagina - 1) * tamano;
  const fin = Math.min(inicio + tamano, total);

  useEffect(() => {
    setPagina((actual) => Math.min(actual, paginas));
  }, [paginas]);

  function cambiarTamano(valor: number) {
    const opcion = tamanosPagina.find((tamano) => tamano === valor);
    if (!opcion) return;
    setTamano(opcion);
    setPagina(1);
  }

  return {
    filas: registros.slice(inicio, fin),
    pagina,
    paginas,
    primero: total ? inicio + 1 : 0,
    fin,
    total,
    tamano,
    anterior: () => setPagina(Math.max(1, pagina - 1)),
    siguiente: () => setPagina(Math.min(paginas, pagina + 1)),
    reiniciar: () => setPagina(1),
    cambiarTamano,
  };
}
