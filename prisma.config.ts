import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

if (existsSync('.env.local')) loadEnvFile('.env.local');
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx scripts/seed.ts' },
  // A non-routable default permits generate/build without migration credentials.
  // Never silently fall back to the storefront's runtime credentials.
  datasource: {
    url: process.env.DIRECT_URL || 'postgresql://unconfigured@127.0.0.1:1/unconfigured',
  },
});
