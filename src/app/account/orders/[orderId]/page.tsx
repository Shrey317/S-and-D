import { OrderDetail } from '@/components/account/order-detail';
export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  return <OrderDetail id={(await params).orderId} />;
}
