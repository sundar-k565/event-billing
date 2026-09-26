'use client';
import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, errorMessage } from '@/lib/client';
import type { Profile } from '@/lib/types';
export function Logout() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    try {
      await api('/api/auth/logout', {});
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A full navigation clears the authenticated router cache on this shared terminal.
      window.location.assign('/login');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <>
      <button className="quiet" onClick={logout} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
export function Shell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const path = usePathname();
  const links =
    profile.role === 'ADMIN'
      ? [
          ['/pos', 'Billing'],
          ['/admin', 'Overview'],
          ['/admin/bills', 'Bills'],
          ['/admin/reports', 'Reports'],
          ['/admin/menu', 'Menu'],
          ['/admin/settings/users', 'Users'],
          ['/admin/settings', 'Settings'],
          ['/admin/audit', 'Audit'],
        ]
      : [
          ['/pos', 'Billing'],
          ['/bills', 'Reprint'],
        ];
  return (
    <>
      <header className="app-header no-print">
        <Link href="/pos" className="brand">
          WAAAT<span>POS / THE EVENTS</span>
        </Link>
        <nav>
          {links.map(([href, label]) => (
            <Link key={href} className={path === href ? 'nav-active' : ''} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="operator">
          <span>
            {profile.display_name}
            <small>{profile.role}</small>
          </span>
          <Logout />
        </div>
      </header>
      {children}
    </>
  );
}
