import { sortCategories } from '@/config/categories';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel } from '@/components/admin/ui';
import { ProductEditor, VariantEditor } from '@/components/admin/product-editor';
import { ImageManager } from '@/components/admin/image-manager';
export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { db } = await adminContext(),
    { productId } = await params;
  if (!z.uuid().safeParse(productId).success) notFound();
  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id: productId },
      include: {
        variants: { orderBy: { position: 'asc' } },
        images: { orderBy: { position: 'asc' } },
      },
    }),
    db.category.findMany({ orderBy: { position: 'asc' } }),
  ]);
  if (!product) notFound();
  return (
    <AdminScreen title={product.name}>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Product details">
          <ProductEditor product={product} categories={sortCategories(categories)} />
        </Panel>
        <div className="grid gap-6">
          <Panel title="Images">
            <ImageManager productId={product.id} images={product.images} />
          </Panel>
          <Panel title="Add selling variant">
            <VariantEditor productId={product.id} />
          </Panel>
        </div>
      </div>
      <Link className="underline" href={`/admin/inventory?q=${encodeURIComponent(product.name)}`}>
        Manage stock for this product
      </Link>
      <div className="grid gap-6 lg:grid-cols-2">
        {product.variants.map((v) => (
          <Panel key={v.id} title={v.label}>
            <VariantEditor productId={product.id} variant={v} />
          </Panel>
        ))}
      </div>
    </AdminScreen>
  );
}
