'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { indiaTime } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import type { Bill } from '@/lib/types';
type Row = Pick<
  Bill,
  'id' | 'billNumber' | 'createdAt' | 'paymentMethod' | 'status' | 'totalPaise'
>;
export function BillHistory({ admin }: { admin: boolean }) {
  const [result, setResult] = useState<{ bills: Row[]; total: number }>({ bills: [], total: 0 }),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);
  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoading(true);
    setError('');
    try {
      const next = await api<{ bills: Row[]; total: number }>(`/api/bills?page=${page}&${query}`);
      if (request === latestRequest.current) setResult(next);
    } catch (e) {
      if (request === latestRequest.current) setError(errorMessage(e));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [page, query]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Fetch external history when filters change; loading describes that request.
    void load();
  }, [load]);
  function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget),
      params = new URLSearchParams();
    values.forEach((v, k) => {
      if (v) params.set(k, String(v));
    });
    setPage(1);
    setQuery(params.toString());
  }
  return (
    <main className="content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{admin ? 'ALL TRANSACTIONS' : 'YOUR TRANSACTIONS'}</div>
          <h1>{admin ? 'Bill history' : 'Reprint a bill'}</h1>
        </div>
        <button onClick={load}>Refresh</button>
      </div>
      {!admin && (
        <p className="muted">
          Your saved bills are available here. An administrator can find bills created by other
          operators.
        </p>
      )}
      <form className="filter-bar" onSubmit={search}>
        <label>
          Bill number
          <input name="billNumber" placeholder="WAAAT-0001" />
        </label>
        <label>
          Date (India)
          <input type="date" name="date" />
        </label>
        <label>
          Payment
          <select name="paymentMethod">
            <option value="">All payments</option>
            {['CASH', 'UPI', 'CARD'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status">
            <option value="">All statuses</option>
            <option>COMPLETED</option>
            <option>VOID</option>
          </select>
        </label>
        <button className="primary">Search</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bill number</th>
              <th>Date / time</th>
              <th>Amount</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {result.bills.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={`/bills/${b.id}`}>{b.billNumber}</Link>
                </td>
                <td>{indiaTime(b.createdAt)}</td>
                <td>{formatMoney(b.totalPaise)}</td>
                <td>{b.paymentMethod}</td>
                <td>
                  <span className={`pill ${b.status === 'VOID' ? 'void' : ''}`}>{b.status}</span>
                </td>
                <td>
                  <Link href={`/bills/${b.id}`}>View</Link> ·{' '}
                  <a href={`/bills/${b.id}/receipt?print=1`} target="waaat-receipt">
                    Reprint ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <p role="status">Loading bills…</p>
        ) : (
          !result.bills.length && <p className="empty">No bills match these filters.</p>
        )}
      </div>
      <div className="pagination">
        <button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} · {result.total} bills
        </span>
        <button disabled={page * 50 >= result.total || loading} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </div>
    </main>
  );
}
export function BillDetail({ initial, admin }: { initial: Bill; admin: boolean }) {
  const [bill, setBill] = useState(initial),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function voidBill(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api<{ bill: Bill }>(`/api/bills/${bill.id}/void`, { reason });
      setBill(result.bill);
    } catch (e) {
      setError(errorMessage(e));
      try {
        const result = await api<{ bill: Bill }>(`/api/bills/${bill.id}`);
        setBill(result.bill);
      } catch {}
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="content narrow">
      <div className="section-heading">
        <div>
          <div className="eyebrow">SAVED BILL / {bill.status}</div>
          <h1>{bill.billNumber}</h1>
          <p>
            {indiaTime(bill.createdAt)} · {bill.operatorName}
          </p>
        </div>
        <a
          className="button primary"
          href={`/bills/${bill.id}/receipt?print=1`}
          target="waaat-receipt"
        >
          Reprint ↗
        </a>
      </div>
      <section className="panel">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit price</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((i) => (
              <tr key={i.productId}>
                <td>
                  {i.productName}
                  <small>{i.unitLabel}</small>
                </td>
                <td>{formatMoney(i.unitPricePaise)}</td>
                <td>{i.quantity}</td>
                <td>{formatMoney(i.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="total">
          <span>TOTAL · {bill.paymentMethod}</span>
          <strong>{formatMoney(bill.totalPaise)}</strong>
        </div>
      </section>
      {bill.status === 'VOID' ? (
        <div className="panel danger">
          <h2>Voided</h2>
          <p>{bill.voidReason}</p>
          <p>{bill.voidedAt && indiaTime(bill.voidedAt)}</p>
        </div>
      ) : (
        admin && (
          <form onSubmit={voidBill} className="panel">
            <h2>Void this bill</h2>
            <p>
              Preserves the receipt and removes this amount from completed sales. This cannot be
              undone.
            </p>
            <label>
              Reason
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={500}
              />
            </label>
            <button className="danger" disabled={busy || !reason.trim()}>
              {busy ? 'Voiding…' : 'Void bill'}
            </button>
          </form>
        )
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  );
}
