import { redirect } from 'next/navigation';

export default function VisitPage({ params }: { params: { visitId: string } }) {
  redirect(`/opd/visit/${params.visitId}/overview`);
}
