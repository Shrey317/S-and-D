import { OrderDetail } from '@/components/account/order-detail';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Test order confirmation' };
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  return (
    <main id="main-content" className="site-container py-12 sm:py-16">
      <OrderDetail id={(await params).orderId} confirmation />
    </main>
  );
}
