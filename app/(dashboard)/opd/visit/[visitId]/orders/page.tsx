'use client';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const OrdersPanel = dynamic(() => import('@/components/opd/panels/OrdersPanel'), { ssr: false });

export default function OrdersPage() {
  const { visitId } = useParams();
  return <OrdersPanel visitId={visitId as string} />;
}
