'use client';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { formatMoney } from '@/lib/money';
import type { Report } from '@/lib/types';
import { indiaDate } from '@/lib/date';
export function Reports({ initial, dashboard = false }: { initial: Report; dashboard?: boolean }) {
  const [report, setReport] = useState(initial),
    [date, setDate] = useState(initial.date),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function load(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setReport(await api(`/api/reports/daily?date=${dashboard ? indiaDate() : date}`));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">WAAAT / {dashboard ? 'TONIGHT AT A GLANCE' : 'DAILY SALES'}</div>
          <h1>{dashboard ? 'The evening, in numbers.' : 'Daily report'}</h1>
          <p>{report.date} · Asia/Kolkata</p>
        </div>
        <form className="inline-form" onSubmit={load}>
          {!dashboard && (
            <label>
              Business date
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          )}
          <button disabled={busy}>{busy ? 'Loading…' : 'Refresh report'}</button>
        </form>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="metrics">
        <div className="metric hero-metric">
          <span>Completed sales</span>
          <strong>{formatMoney(report.completedSalesPaise)}</strong>
          <small>{report.completedBills} completed bills</small>
        </div>
        {(['CASH', 'UPI', 'CARD'] as const).map((p) => (
          <div className="metric" key={p}>
            <span>{p}</span>
            <strong>{formatMoney(report.paymentBreakdown[p])}</strong>
            <small>Completed payments</small>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Top-selling products</h2>
          <span className="muted">Completed bills only</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Sales</th>
            </tr>
          </thead>
          <tbody>
            {report.topItems.map((i, n) => (
              <tr key={n}>
                <td>{i.productName}</td>
                <td>{i.quantity}</td>
                <td>{formatMoney(i.salesPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!report.topItems.length && <p className="empty">No completed sales for this date.</p>}
      </section>
      <div className="void-summary">
        <span>{report.voidCount} voided bills</span>
        <strong>{formatMoney(report.voidedAmountPaise)}</strong>
        <small>Excluded from completed sales. Based on original bill date.</small>
      </div>
    </main>
  );
}
