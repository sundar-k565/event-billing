import { pageSession } from '@/lib/server/auth';
import { Shell } from '@/components/shell';
export const dynamic = 'force-dynamic';
export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await pageSession();
  return <Shell profile={profile}>{children}</Shell>;
}
