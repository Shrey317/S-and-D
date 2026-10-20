import { z } from 'zod';

const optionalValue = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const publicOrigin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    ['http:', 'https:'].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === '/'
  );
});

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: publicOrigin.default('http://localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    publicOrigin.optional(),
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalValue,
});

export function parsePublicEnv(input: Record<string, unknown>) {
  const result = publicEnvSchema.safeParse(input);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid public configuration: ${names.join(', ')}. Check .env.example.`);
  }
  return result.data;
}

// Explicit references are required for Next.js browser-time substitution.
// Never spread process.env or import the server environment into this module.
export function getPublicEnv() {
  return parsePublicEnv({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
