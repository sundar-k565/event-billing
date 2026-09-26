import { notFound } from 'next/navigation';
import { pageSession } from '@/lib/server/auth';
import { getBill } from '@/lib/server/data';
import { uuid } from '@/lib/validation';
import { HttpError } from '@/lib/permissions';
import { BillDetail } from '@/components/bills';
export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, profile } = await pageSession();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const bill = await getBill(db, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return <BillDetail initial={bill} admin={profile.role === 'ADMIN'} />;
}
