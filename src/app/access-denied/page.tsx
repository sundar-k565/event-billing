import Link from 'next/link';
import { Logout } from '@/components/shell';
export default function Denied() {
  return (
    <main className="center">
      <section className="panel">
        <h1>Access unavailable</h1>
        <p>
          This account does not have permission, or has been deactivated. Contact the administrator.
        </p>
        <Link href="/pos">Back to POS</Link>
        <Logout />
      </section>
    </main>
  );
}
