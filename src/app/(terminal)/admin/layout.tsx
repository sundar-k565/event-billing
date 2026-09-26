import { pageSession } from '@/lib/server/auth';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await pageSession(true);
  return children;
}
