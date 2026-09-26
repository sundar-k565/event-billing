import { notFound } from 'next/navigation';
import { pageSession } from '@/lib/server/auth';
import { getBill } from '@/lib/server/data';
import { uuid } from '@/lib/validation';
import { HttpError } from '@/lib/permissions';
import { Receipt } from '@/components/receipt';
export const dynamic = 'force-dynamic';
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { db } = await pageSession();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const bill = await getBill(db, id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return <Receipt bill={bill} autoPrint={(await searchParams).print === '1'} />;
}
