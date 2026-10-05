import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <p className="gradient-text text-6xl font-semibold">404</p>
      <h1 className="mt-3 text-xl font-semibold text-fg">Page not found</h1>
      <p className="mt-1 text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
