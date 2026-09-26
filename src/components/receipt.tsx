'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '@/lib/money';
import { indiaTime } from '@/lib/date';
import type { Bill } from '@/lib/types';
export function Receipt({ bill, autoPrint }: { bill: Bill; autoPrint: boolean }) {
  const once = useRef(false);
  const [message, setMessage] = useState('');
  function print() {
    try {
      window.print();
    } catch {
      setMessage('The bill is saved. Use Print receipt to try again.');
    }
  }
  useEffect(() => {
    if (autoPrint && !once.current) {
      once.current = true;
      const timer = setTimeout(() => {
        try {
          window.print();
        } catch {
          setMessage('The bill is saved. Use Print receipt to try again.');
        }
      }, 350);
      return () => {
        clearTimeout(timer);
        once.current = false;
      };
    }
  }, [autoPrint]);
  return (
    <main className="receipt-page">
      <div className="receipt-actions no-print">
        <Link href="/pos">← Next bill</Link>
        <button className="primary" onClick={print}>
          Print receipt
        </button>
        <p role="status">{message || 'Bill saved. Cancelling print does not cancel this bill.'}</p>
      </div>
      <article className="receipt">
        <h1>{bill.businessName}</h1>
        {bill.status === 'VOID' && <h2>VOID — NOT A SALE</h2>}
        <p>
          Bill: <strong>{bill.billNumber}</strong>
          <br />
          {indiaTime(bill.createdAt)}
          <br />
          Operator: {bill.operatorName}
        </p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.items.map((i) => (
              <tr key={i.productId}>
                <td>
                  {i.productName}
                  <small>
                    {i.unitLabel} · {formatMoney(i.unitPricePaise)}
                  </small>
                </td>
                <td>{i.quantity}</td>
                <td>{formatMoney(i.lineTotalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="receipt-total">
          <strong>TOTAL</strong>
          <strong>{formatMoney(bill.totalPaise)}</strong>
        </div>
        <p>Payment: {bill.paymentMethod}</p>
        {bill.voidReason && <p>Void reason: {bill.voidReason}</p>}
        <footer>{bill.receiptFooter}</footer>
      </article>
    </main>
  );
}
