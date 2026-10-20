import { notFound } from 'next/navigation';
import { z } from 'zod';
import { adminContext } from '@/server/admin/context';
import { AdminScreen } from '@/components/admin/ui';
import { PromotionEditor } from '@/components/admin/promotion-editor';
export default async function PromotionPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const { db } = await adminContext(),
    { promotionId } = await params;
  if (promotionId !== 'new' && !z.uuid().safeParse(promotionId).success) notFound();
  const [promotion, products, variants] = await Promise.all([
    promotionId === 'new' ? null : db.promotion.findUnique({ where: { id: promotionId } }),
    db.product.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.productVariant.findMany({
      select: { id: true, label: true, product: { select: { name: true } } },
      orderBy: { sku: 'asc' },
    }),
  ]);
  if (promotionId !== 'new' && !promotion) notFound();
  return (
    <AdminScreen
      title={promotion?.name || 'New promotion'}
      description="For bundles, enter the discount per complete set of the two variants. Dates use Johannesburg time. All changes require a reason."
    >
      <div className="max-w-2xl">
        <PromotionEditor
          promotion={promotion || undefined}
          products={products}
          variants={variants}
        />
      </div>
    </AdminScreen>
  );
}
