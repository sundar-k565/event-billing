'use client';
import { newIdempotencyKey } from '@/lib/idempotency';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { addItem, cartTotal, setQuantity } from '@/lib/cart';
import { formatMoney, lineTotal } from '@/lib/money';
import { api, ApiError, errorMessage } from '@/lib/client';
import { billSchema } from '@/lib/validation';
import type { Bill, BillInput, CartLine, Category, Payment } from '@/lib/types';
const draftSchema = z.object({
  cart: z
    .array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        pricePaise: z.string().regex(/^\d+$/),
        unitLabel: z.string(),
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(200),
  payment: z.enum(['CASH', 'UPI', 'CARD']).nullable(),
  pending: billSchema.nullable(),
  last: z.object({ id: z.uuid(), billNumber: z.string(), totalPaise: z.string() }).nullable(),
});
type Draft = {
  cart: CartLine[];
  payment: Payment | null;
  pending: BillInput | null;
  last: Pick<Bill, 'id' | 'billNumber' | 'totalPaise'> | null;
};
const empty: Draft = { cart: [], payment: null, pending: null, last: null };
export function Pos({ categories: initial, userId }: { categories: Category[]; userId: string }) {
  const [categories, setCategories] = useState(initial),
    [category, setCategory] = useState(initial[0]?.id ?? ''),
    [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft>(empty),
    [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState('');
  const busy = useRef(false);
  const storageKey = `waaat-cart-v1:${userId}`;
  // Storage is only available after browser hydration; restore once per operator.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const restored = draftSchema.parse(JSON.parse(raw));
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize the external per-tab recovery store after hydration.
        setDraft(restored);
        if (restored.pending)
          setMessage('A previous save needs confirmation. Retry to recover the same bill.');
      }
      setReady(true);
    } catch {
      setMessage(
        'Could not restore the cart. Keep this tab open and contact the administrator before starting another bill.',
      );
    }
  }, [storageKey]);
  function persist(next: Draft) {
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    setDraft(next);
  }
  function edit(change: () => Draft) {
    try {
      persist(change());
      setMessage('');
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
  async function refreshMenu() {
    try {
      const result = await api<{ categories: Category[] }>('/api/menu');
      setCategories(result.categories);
      setMessage(
        'Menu refreshed. Existing cart prices are estimates; current database prices apply when saved.',
      );
    } catch (e) {
      setMessage(errorMessage(e));
    }
  }
  async function save() {
    if (busy.current || !ready || !draft.cart.length || !draft.payment) return;
    busy.current = true;
    setSaving(true);
    setMessage('Saving bill…');
    let popup: Window | null = null;
    try {
      const pending = draft.pending ?? {
        idempotencyKey: newIdempotencyKey(),
        paymentMethod: draft.payment,
        items: draft.cart.map((i) => ({ productId: i.id, quantity: i.quantity })),
      };
      persist({ ...draft, pending });
      // Popup policy must never prevent saving the sale.
      try {
        popup = window.open('about:blank', 'waaat-receipt', 'width=460,height=760');
      } catch {
        popup = null;
      }
      const { bill } = await api<{ bill: Bill }>('/api/bills', pending);
      // Even if storage fails after a committed sale, the pending key recovers this same bill.
      let storageFailed = false;
      try {
        persist({ ...empty, last: bill });
      } catch {
        setDraft({ ...empty, last: bill });
        setReady(false);
        storageFailed = true;
      }
      setMessage(
        `Bill ${bill.billNumber} created · ${formatMoney(bill.totalPaise)}. ${storageFailed ? 'Browser storage failed. Reopen this tab and retry to recover this saved bill before continuing.' : popup ? 'Opening print…' : 'Use Print receipt below.'}`,
      );
      if (popup) {
        try {
          popup.location.href = `/bills/${bill.id}/receipt?print=1`;
        } catch {
          setMessage(`Bill ${bill.billNumber} is saved. Use Print receipt below to print.`);
        }
      }
    } catch (e) {
      try {
        popup?.close();
      } catch {
        /* The receipt window may no longer be accessible. */
      }
      if (e instanceof ApiError && e.status === 422) {
        try {
          persist({ ...draft, pending: null });
        } catch {
          setReady(false);
        }
        setMessage(`Could not save bill. Your cart has been kept. ${e.message}`);
      } else
        setMessage(
          `${errorMessage(e)} Save outcome is unconfirmed; retry this bill to check safely. Your cart has been kept.`,
        );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const locked = saving || !!draft.pending || !ready;
  const selected = categories.find((c) => c.id === category);
  const products = search.trim()
    ? categories
        .flatMap((c) => c.products)
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : (selected?.products ?? []);
  const total = cartTotal(draft.cart);
  return (
    <main className="pos-layout">
      <section className="catalog">
        <div className="section-heading">
          <div>
            <div className="eyebrow">READY FOR THE NIGHT</div>
            <h1>Make it a good one.</h1>
          </div>
          <button className="quiet" onClick={refreshMenu} disabled={saving}>
            Refresh menu
          </button>
        </div>
        <div className="category-groups">
          {['ALCOHOL', 'FOOD', 'BEVERAGE'].map((group) => (
            <div key={group}>
              <div className="eyebrow">
                {group === 'ALCOHOL'
                  ? 'THE BAR'
                  : group === 'FOOD'
                    ? 'THE KITCHEN'
                    : 'NON-ALCOHOLIC'}
              </div>
              <div className="categories">
                {categories
                  .filter((c) => c.groupType === group)
                  .map((c) => (
                    <button
                      key={c.id}
                      aria-pressed={category === c.id && !search}
                      className={category === c.id && !search ? 'selected' : ''}
                      onClick={() => {
                        setCategory(c.id);
                        setSearch('');
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <div className="product-heading">
          <h2>{search ? 'Search results' : (selected?.name ?? 'Menu unavailable')}</h2>
          <input
            aria-label="Search products"
            placeholder="Search menu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!categories.length && (
          <p className="empty">
            No billable products. Ask an administrator to import or configure the menu.
          </p>
        )}
        <div className="products">
          {products.map((p) => {
            const qty = draft.cart.find((i) => i.id === p.id)?.quantity;
            return (
              <button
                className="product"
                key={p.id}
                disabled={locked}
                onClick={() => edit(() => ({ ...draft, cart: addItem(draft.cart, p) }))}
              >
                <span className="product-name">{p.name}</span>
                <small>{p.unitLabel}</small>
                <strong>{formatMoney(p.pricePaise)}</strong>
                {qty && <span className="quantity-badge">{qty}</span>}
              </button>
            );
          })}
        </div>
      </section>
      <aside className="cart-panel">
        <div className="cart-title">
          <div>
            <div className="eyebrow">CURRENT BILL</div>
            <h2>New sale</h2>
          </div>
          <span className="pill">{draft.cart.reduce((n, i) => n + i.quantity, 0)} items</span>
        </div>
        <div className="cart-lines">
          {!draft.cart.length ? (
            <div className="empty-cart">
              <span>＋</span>
              <h3>Ready for the first item.</h3>
              <p>Choose a category, then tap a product.</p>
            </div>
          ) : (
            draft.cart.map((i) => (
              <div className="cart-line" key={i.id}>
                <div className="line-label">
                  <strong>{i.name}</strong>
                  <small>
                    {i.unitLabel} · {formatMoney(i.pricePaise)} each
                  </small>
                  <button
                    className="text-button"
                    disabled={locked}
                    onClick={() =>
                      edit(() => ({ ...draft, cart: setQuantity(draft.cart, i.id, 0) }))
                    }
                  >
                    Remove
                  </button>
                </div>
                <div className="line-controls">
                  <strong>{formatMoney(lineTotal(i.pricePaise, i.quantity))}</strong>
                  <div className="stepper">
                    <button
                      aria-label={`Decrease ${i.name}`}
                      disabled={locked}
                      onClick={() =>
                        edit(() => ({
                          ...draft,
                          cart: setQuantity(draft.cart, i.id, i.quantity - 1),
                        }))
                      }
                    >
                      −
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={`Increase ${i.name}`}
                      disabled={locked || i.quantity >= 999}
                      onClick={() =>
                        edit(() => ({
                          ...draft,
                          cart: setQuantity(draft.cart, i.id, i.quantity + 1),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="checkout">
          <div className="subtotal">
            <span>Subtotal</span>
            <span>{formatMoney(total)}</span>
          </div>
          <div className="total">
            <span>TOTAL</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className="eyebrow">PAYMENT METHOD</div>
          <div className="payment-options">
            {(['CASH', 'UPI', 'CARD'] as Payment[]).map((p) => (
              <button
                key={p}
                className={draft.payment === p ? 'selected' : ''}
                aria-pressed={draft.payment === p}
                disabled={locked}
                onClick={() => edit(() => ({ ...draft, payment: p }))}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            className="primary save"
            disabled={!ready || saving || !draft.cart.length || !draft.payment}
            onClick={save}
          >
            {saving
              ? 'Saving bill…'
              : draft.pending
                ? 'Retry / confirm saved bill'
                : 'Save & Print →'}
          </button>
          {message && (
            <p role="status" className="feedback">
              {message}
            </p>
          )}
          {draft.pending && (
            <p className="muted">
              Cart editing is paused until this save is confirmed.{' '}
              <Link href="/login">Sign in again</Link> if your session expired.
            </p>
          )}
          {draft.last && (
            <div className="last-bill">
              <span>
                Last bill <strong>{draft.last.billNumber}</strong>
              </span>
              <a href={`/bills/${draft.last.id}/receipt?print=1`} target="waaat-receipt">
                Print receipt ↗
              </a>
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
