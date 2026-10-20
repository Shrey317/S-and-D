import type { ProductImage } from '@/generated/prisma/client';
import { serverEnv } from '@/config/env.server';
import { ActionForm } from '@/components/account/action-form';
import { imageDetailsAction, removeImageAction } from '@/server/admin/images';
import { ImageUploadForm } from './image-upload-form';
export function ImageManager({ productId, images }: { productId: string; images: ProductImage[] }) {
  return (
    <div className="grid gap-6">
      {!serverEnv.CLOUDINARY_ENABLED && (
        <p>
          Cloudinary is not configured. Existing image metadata can be edited; upload and hosted
          deletion remain unavailable.
        </p>
      )}
      <ImageUploadForm productId={productId} enabled={serverEnv.CLOUDINARY_ENABLED} />
      {images.map((image) => (
        <div key={image.id} className="grid gap-4 border-t pt-5">
          <p className="text-sm">Source: {image.provenance}</p>
          <ActionForm
            action={imageDetailsAction}
            hidden={{ id: image.id }}
            label="Save image details"
            fields={[
              {
                name: 'alt',
                label: 'Image description',
                value: image.alt,
                required: true,
                maxLength: 240,
              },
              {
                name: 'position',
                label: 'Display order (lowest first)',
                type: 'number',
                value: String(image.position),
                required: true,
              },
            ]}
          />
          <ActionForm
            action={removeImageAction}
            hidden={{ id: image.id }}
            label="Remove image"
            disabled={!serverEnv.CLOUDINARY_ENABLED}
          />
        </div>
      ))}
    </div>
  );
}
