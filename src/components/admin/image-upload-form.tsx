'use client';
import { useActionState } from 'react';
import { uploadImageAction } from '@/server/admin/images';
import { initialFormResult } from '@/features/account/validation';
import { Button } from '@/components/ui/button';
export function ImageUploadForm({ productId, enabled }: { productId: string; enabled: boolean }) {
  const [state, action, pending] = useActionState(uploadImageAction, initialFormResult);
  const field = 'mt-2 w-full rounded-lg border bg-card p-3';
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="productId" value={productId} />
      <label>
        Product photograph (JPEG, PNG, WebP, up to 5 MB)
        <input
          className={field}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={!enabled || pending}
        />
      </label>
      <label>
        Image description
        <input
          className={field}
          name="alt"
          required
          maxLength={240}
          disabled={!enabled || pending}
        />
      </label>
      <label>
        Image source and rights
        <input
          className={field}
          name="provenance"
          required
          maxLength={1000}
          disabled={!enabled || pending}
        />
      </label>
      <Button type="submit" disabled={!enabled || pending}>
        {pending ? 'Uploading…' : 'Upload image'}
      </Button>
      <p role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>
    </form>
  );
}
