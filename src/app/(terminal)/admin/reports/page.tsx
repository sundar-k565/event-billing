import { pageSession } from '@/lib/server/auth';
import { getReport } from '@/lib/server/data';
import { indiaDate } from '@/lib/date';
import { Reports } from '@/components/reports';
export default async function ReportPage() {
  const { db } = await pageSession(true);
  return <Reports initial={await getReport(db, indiaDate())} />;
}
