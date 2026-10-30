/** Página provisional para módulos que todavía no se implementaron. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="muted">Este módulo está en construcción.</p>
    </>
  );
}
