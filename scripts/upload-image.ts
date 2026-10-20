import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseServerEnv } from '../src/config/env.schema';
import { loadLocalEnvironment, toolingDatabase } from './database-tools';
import { cloudinaryProvider } from '../src/server/images/cloudinary';
import { uploadCatalogImage } from '../src/server/images/upload';

loadLocalEnvironment();
async function main() {
  const env = parseServerEnv(process.env);
  const [manifestPath] = process.argv.slice(2);
  if (!manifestPath || !env.CLOUDINARY_ENABLED || !env.DIRECT_URL)
    throw new Error(
      'Configure Cloudinary and operator database access, and provide a local JSON manifest.',
    );
  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8')) as {
    file: string;
    productId: string;
    alt: string;
    provenance: string;
  };
  const file = resolve(manifest.file);
  if ((await stat(file)).size > 5 * 1024 * 1024) throw new Error('File too large.');
  const db = toolingDatabase(env.DIRECT_URL);
  try {
    const record = await uploadCatalogImage(
      db,
      cloudinaryProvider({
        cloudName: env.CLOUDINARY_CLOUD_NAME!,
        apiKey: env.CLOUDINARY_API_KEY!,
        apiSecret: env.CLOUDINARY_API_SECRET!,
      }),
      await readFile(file),
      { productId: manifest.productId, alt: manifest.alt, provenance: manifest.provenance },
    );
    console.log(`Product image attached: ${record.id}`);
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Image upload refused or failed. Check operator permissions, manifest, file type/size and service configuration. No credentials were logged.',
  );
  process.exitCode = 1;
});
