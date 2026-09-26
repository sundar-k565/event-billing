'use client';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';
export function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ redirect: string }>('/api/auth/login', {
        email: form.get('email'),
        password: form.get('password'),
      });
      window.location.assign(result.redirect);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="login-card panel">
      <div className="eyebrow">THE EVENTS / CASHIER TERMINAL</div>
      <h1>
        WAAAT<span className="pink">.</span>
      </h1>
      <p>Good evenings start here.</p>
      <label>
        Email
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label>
        Password
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="primary" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in →'}
      </button>
      <small>Authorized staff and administrators only.</small>
    </form>
  );
}
