import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma, ProductImage } from '@/generated/prisma/client';
import { z } from 'zod';

export const imageInputSchema = z
  .object({
    productId: z.uuid(),
    alt: z.string().trim().min(1).max(240),
    provenance: z.string().trim().min(1).max(1000),
  })
  .strict();
export type UploadedImage = {
  assetId: string;
  publicId: string;
  version: number;
  format: string;
  width: number;
  height: number;
};
export type ImageProvider = {
  upload: (buffer: Buffer, publicId: string) => Promise<UploadedImage>;
  remove: (publicId: string) => Promise<void>;
};
export function validateImageBytes(buffer: Buffer) {
  if (buffer.length < 12 || buffer.length > 5 * 1024 * 1024)
    throw new Error('Use an image between 12 bytes and 5 MB.');
  const jpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp =
    buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!jpg && !png && !webp) throw new Error('Only JPEG, PNG and WebP files are accepted.');
}
export async function uploadCatalogImage(
  db: PrismaClient,
  provider: ImageProvider,
  buffer: Buffer,
  rawInput: unknown,
  persist?: (data: Prisma.ProductImageUncheckedCreateInput) => Promise<ProductImage>,
) {
  const input = imageInputSchema.parse(rawInput);
  validateImageBytes(buffer);
  // Operator credential boundary. No browser endpoint exists before administrator Auth is available.
  const permission = await db.$queryRaw<
    { allowed: boolean }[]
  >`SELECT has_table_privilege(current_user, 'commerce."ProductImage"', 'INSERT') AS allowed`;
  if (!permission[0]?.allowed)
    throw new Error('Image changes require an authorized catalog operator.');
  if (!(await db.product.findUnique({ where: { id: input.productId }, select: { id: true } })))
    throw new Error('Product not found.');
  const publicId = `sd-catalog/${input.productId}/${randomUUID()}`;
  const asset = await provider.upload(buffer, publicId);
  try {
    if (
      asset.publicId !== publicId ||
      !asset.assetId ||
      !['jpg', 'png', 'webp'].includes(asset.format) ||
      !Number.isSafeInteger(asset.version) ||
      asset.version < 1 ||
      !Number.isSafeInteger(asset.width) ||
      !Number.isSafeInteger(asset.height) ||
      asset.width < 1 ||
      asset.height < 1 ||
      asset.width * asset.height > 40_000_000
    )
      throw new Error('Invalid uploaded image metadata.');
    const data = {
      ...asset,
      productId: input.productId,
      alt: input.alt,
      provenance: input.provenance,
    };
    return await (persist ? persist(data) : db.productImage.create({ data }));
  } catch {
    // Remove only the new, scoped upload. Never delete an existing product image.
    try {
      await provider.remove(publicId);
    } catch {
      console.error('New image cleanup failed; review Cloudinary sd-catalog assets.');
    }
    throw new Error('Image could not be attached.');
  }
}
