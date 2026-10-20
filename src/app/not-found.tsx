import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4 text-muted-foreground">
        This page does not exist or is not available yet.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        Return to the homepage
      </Link>
    </main>
  );
}
