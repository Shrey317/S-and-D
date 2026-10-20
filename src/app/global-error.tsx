'use client';
import Link from 'next/link';
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-ZA">
      <body>
        <main>
          <h1>The store is temporarily unavailable</h1>
          <p>
            Please try again shortly. No order or payment status should be inferred from this error.
          </p>
          <button onClick={reset}>Try again</button>
          <Link href="/">Return to the homepage</Link>
        </main>
      </body>
    </html>
  );
}
