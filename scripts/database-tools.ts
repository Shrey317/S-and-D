import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

export function loadLocalEnvironment() {
  if (existsSync('.env.local')) loadEnvFile('.env.local');
}
export function toolingDatabase(url: string) {
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: url, options: '-c timezone=UTC', max: 2, connectionTimeoutMillis: 5000 },
      { schema: 'commerce' },
    ),
  });
}
export function assertLocalTarget(url: string, environment: string | undefined) {
  const target = new URL(url);
  if (
    !['development', 'test'].includes(environment ?? '') ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    !['/sd_catalog_dev', '/sd_catalog_test'].includes(target.pathname)
  ) {
    throw new Error(
      'Development data requires an isolated local sd_catalog_dev or sd_catalog_test target and development/test environment.',
    );
  }
}
