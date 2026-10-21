import { supabaseRootCertificate } from './supabase-certificate';

/** Attach the dashboard's public CA without allowing URL options to override TLS. */
export function databaseConnection(connectionString: string) {
  const url = new URL(connectionString);
  if (url.hostname !== 'aws-0-eu-west-1.pooler.supabase.com') return { connectionString };
  if (
    url.searchParams.get('sslmode') !== 'verify-full' ||
    url.searchParams.getAll('sslmode').length !== 1 ||
    [...url.searchParams.keys()].some((key) => key !== 'sslmode')
  )
    throw new Error('Supabase staging database requires verified TLS without URL overrides.');
  // pg replaces an explicit ssl object if sslmode is also in the URL.
  url.searchParams.delete('sslmode');
  return {
    connectionString: url.href,
    ssl: { ca: supabaseRootCertificate, rejectUnauthorized: true },
  };
}
