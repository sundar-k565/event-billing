'use client';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { indiaTime } from '@/lib/date';
import type { Profile } from '@/lib/types';
export function Users() {
  const [users, setUsers] = useState<Profile[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function load() {
    try {
      const r = await api<{ users: Profile[] }>('/api/admin/users');
      setUsers(r.users);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial external user-list fetch.
    void load();
  }, []);
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = e.currentTarget,
      f = new FormData(form);
    try {
      await api('/api/admin/users', {
        display_name: f.get('display_name'),
        email: f.get('email'),
        password: f.get('password'),
      });
      form.reset();
      setMessage('Staff account created. Share the initial password securely.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      await load();
      setBusy(false);
    }
  }
  return (
    <main className="content">
      <div className="eyebrow">ADMINISTRATION / ACCESS</div>
      <h1>Your team</h1>
      <form className="panel" onSubmit={create}>
        <h2>Create staff account</h2>
        <div className="form-grid">
          <label>
            Name
            <input name="display_name" required maxLength={100} />
          </label>
          <label>
            Email
            <input name="email" type="email" required autoComplete="off" />
          </label>
          <label>
            Initial password
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create staff'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="panel">
        <h2>Operators</h2>
        {users.map((user) => (
          <UserRow key={`${user.id}:${user.role}:${user.active}`} user={user} done={load} />
        ))}
      </div>
    </main>
  );
}
function UserRow({ user, done }: { user: Profile; done: () => Promise<void> }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api(
        `/api/admin/users/${user.id}`,
        {
          display_name: f.get('display_name'),
          role: f.get('role'),
          active: f.get('active') === 'on',
        },
        'PATCH',
      );
      await done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="user-row" onSubmit={save}>
      <label>
        Name
        <input name="display_name" defaultValue={user.display_name} required maxLength={100} />
        <small>{user.email}</small>
      </label>
      <label>
        Role
        <select name="role" defaultValue={user.role}>
          <option>STAFF</option>
          <option>ADMIN</option>
        </select>
      </label>
      <label className="checkbox">
        <input name="active" type="checkbox" defaultChecked={user.active} />
        Active
      </label>
      <button disabled={busy}>{busy ? 'Saving…' : 'Save user'}</button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export function Settings() {
  const [settings, setSettings] = useState<{ display_name: string; receipt_footer: string } | null>(
      null,
    ),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ display_name: string; receipt_footer: string }>('/api/admin/settings')
      .then(setSettings)
      .catch((e) => setError(errorMessage(e)));
  }, []);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/settings', settings, 'PATCH');
      setMessage('Settings saved. Existing receipts keep their original branding.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="content narrow">
      <div className="eyebrow">ADMINISTRATION / RECEIPTS</div>
      <h1>Settings</h1>
      {settings && (
        <form className="panel" onSubmit={save}>
          <label>
            Business display name
            <input
              value={settings.display_name}
              onChange={(e) => setSettings({ ...settings, display_name: e.target.value })}
              required
              maxLength={100}
            />
          </label>
          <label>
            Receipt footer
            <input
              value={settings.receipt_footer}
              onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
              required
              maxLength={200}
            />
          </label>
          <p className="muted">
            Currency: INR · Time zone: Asia/Kolkata
            <br />
            V1 total equals subtotal. No tax or service charges.
          </p>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </main>
  );
}
type Audit = {
  id: string;
  created_at: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
};
export function AuditLog() {
  const [page, setPage] = useState(1),
    [result, setResult] = useState<{ logs: Audit[]; total: number }>({ logs: [], total: 0 }),
    [error, setError] = useState('');
  useEffect(() => {
    api<{ logs: Audit[]; total: number }>(`/api/admin/audit?page=${page}`)
      .then(setResult)
      .catch((e) => setError(errorMessage(e)));
  }, [page]);
  return (
    <main className="content">
      <div className="eyebrow">ADMINISTRATION / ACCOUNTABILITY</div>
      <h1>Audit history</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {result.logs.map((log) => (
              <tr key={log.id}>
                <td>{indiaTime(log.created_at)}</td>
                <td>{log.action}</td>
                <td>
                  <code>{log.actor_id}</code>
                </td>
                <td>
                  <details>
                    <summary>
                      {log.entity_type} · {log.entity_id.slice(0, 8)}
                    </summary>
                    <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.logs.length && <p className="empty">No audit entries.</p>}
      </div>
      <div className="pagination">
        <button disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>Page {page}</span>
        <button disabled={page * 50 >= result.total} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </main>
  );
}
