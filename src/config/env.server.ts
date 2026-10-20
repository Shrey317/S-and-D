import 'server-only';
import { parseServerEnv } from './env.schema';

// Importing this module validates configuration on the server only.
export const serverEnv = parseServerEnv({
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
});
