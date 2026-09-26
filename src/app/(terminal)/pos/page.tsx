import { pageSession } from '@/lib/server/auth';
import { getMenu } from '@/lib/server/data';
import { Pos } from '@/components/pos';
export default async function PosPage() {
  const { db, profile } = await pageSession();
  return <Pos categories={await getMenu(db)} userId={profile.id} />;
}
