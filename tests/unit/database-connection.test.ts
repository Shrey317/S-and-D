import { describe, expect, it } from 'vitest';
import { X509Certificate } from 'node:crypto';
import { databaseConnection } from '@/server/db/connection';

const staging =
  'postgresql://reader:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=verify-full';
describe('staging database certificate verification', () => {
  it('supplies a valid CA and mandatory certificate verification to pg', () => {
    const config = databaseConnection(staging);
    expect(config.ssl?.rejectUnauthorized).toBe(true);
    expect(new X509Certificate(config.ssl!.ca).ca).toBe(true);
    expect(new URL(config.connectionString).search).toBe('');
  });
  it.each([
    'sslmode=require',
    'sslmode=disable',
    'sslmode=verify-full&ssl=false',
    'sslmode=verify-full&sslrootcert=untrusted',
    'sslmode=verify-full&sslmode=disable',
    '',
  ])('rejects unsafe or ambiguous SSL options: %s', (query) => {
    expect(() => databaseConnection(staging.split('?')[0] + '?' + query)).toThrow('verified TLS');
  });
  it('preserves the separate local database configuration', () => {
    const local = 'postgresql://reader:local@127.0.0.1:55432/sd_catalog_dev';
    expect(databaseConnection(local)).toEqual({ connectionString: local });
  });
});
