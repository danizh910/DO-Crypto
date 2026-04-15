import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-muted-foreground mb-6">Seite nicht gefunden.</p>
        <Link
          href="/"
          className="text-primary hover:underline text-sm"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </main>
  );
}
