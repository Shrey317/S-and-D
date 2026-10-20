'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { adminContext } from './context';
import { withAdmin, audit } from './repository';
import { uploadCatalogImage } from '@/server/images/upload';
import { cloudinaryProvider } from '@/server/images/cloudinary';
import { serverEnv } from '@/config/env.server';
import type { FormResult } from '@/features/account/validation';
function provider() {
  if (!serverEnv.CLOUDINARY_ENABLED) throw new Error('Image hosting is not configured.');
  return cloudinaryProvider({
    cloudName: serverEnv.CLOUDINARY_CLOUD_NAME!,
    apiKey: serverEnv.CLOUDINARY_API_KEY!,
    apiSecret: serverEnv.CLOUDINARY_API_SECRET!,
  });
}
export async function uploadImageAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    const file = form.get('image');
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024) throw new Error('Invalid image.');
    await uploadCatalogImage(
      db,
      provider(),
      Buffer.from(await file.arrayBuffer()),
      {
        productId: form.get('productId'),
        alt: form.get('alt'),
        provenance: form.get('provenance'),
      },
      (data) =>
        withAdmin(db, actor, async (tx) => {
          const row = await tx.productImage.create({ data });
          await audit(tx, actor, 'UPLOAD_IMAGE', row.id, 'Product image uploaded with provenance.');
          return row;
        }),
    );
    revalidatePath('/', 'layout');
    return { status: 'success', message: 'Image uploaded and attached.' };
  } catch {
    return {
      status: 'error',
      message:
        'Image could not be attached. Check hosting configuration, JPEG/PNG/WebP file (up to 5 MB), description and image rights.',
    };
  }
}
export async function imageDetailsAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    const id = z.uuid().parse(form.get('id')),
      alt = z.string().trim().min(1).max(240).parse(form.get('alt')),
      position = z.coerce.number().int().min(0).max(100).parse(form.get('position'));
    await withAdmin(db, actor, async (tx) => {
      await tx.productImage.update({ where: { id }, data: { alt, position } });
      await audit(tx, actor, 'EDIT_IMAGE', id, 'Image description / display order updated.');
    });
    revalidatePath('/', 'layout');
    return { status: 'success', message: 'Image details saved.' };
  } catch {
    return { status: 'error', message: 'Unable to update image details.' };
  }
}
export async function removeImageAction(_: FormResult, form: FormData): Promise<FormResult> {
  const { db, actor } = await adminContext(true);
  try {
    const id = z.uuid().parse(form.get('id'));
    const remote = provider();
    const removed = await withAdmin(db, actor, async (tx) => {
      const row = await tx.productImage.findUniqueOrThrow({ where: { id } });
      if (!row.publicId.startsWith(`sd-catalog/${row.productId}/`))
        throw new Error('Unmanaged asset.');
      await tx.productImage.delete({ where: { id } });
      await audit(tx, actor, 'REMOVE_IMAGE', id, 'Image detached from catalog.');
      return row;
    });
    revalidatePath('/', 'layout');
    try {
      await remote.remove(removed.publicId);
    } catch {
      return {
        status: 'success',
        message:
          'Image detached. Remote asset cleanup failed; review the Cloudinary asset before retrying cleanup.',
      };
    }
    return { status: 'success', message: 'Image detached and removed from hosting.' };
  } catch {
    return {
      status: 'error',
      message: 'Unable to remove this image. Confirm hosting is configured.',
    };
  }
}
