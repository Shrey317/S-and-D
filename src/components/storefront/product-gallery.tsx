'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { CatalogImage } from '@/features/catalog/types';
export function ProductGallery({ images }: { images: CatalogImage[] }) {
  const [index, setIndex] = useState(0);
  const selected = images[index]!;
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
        <Image
          src={selected.src}
          alt={selected.alt}
          fill
          sizes="(max-width: 1024px) 90vw, 45vw"
          className="object-cover"
          preload
        />
      </div>
      {selected.illustrative ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Illustrative category photograph, not a photograph of this product.
        </p>
      ) : null}
      {images.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-3" aria-label="Product photographs">
          {images.map((image, position) => (
            <button
              type="button"
              key={image.src}
              aria-label={`Show photograph ${position + 1}`}
              aria-pressed={position === index}
              onClick={() => setIndex(position)}
              className="relative size-20 overflow-hidden rounded-lg border-2 aria-pressed:border-primary"
            >
              <Image src={image.src} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
