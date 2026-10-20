'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-4 text-muted-foreground">The page could not be loaded. Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 min-h-11 rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
