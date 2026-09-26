'use client';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/client';
import { formatMoney, parseRupees, rupeesInput } from '@/lib/money';
import type { AdminCategory, AdminProduct } from '@/lib/types';
type Menu = { categories: AdminCategory[]; products: AdminProduct[] };
export function MenuAdmin() {
  const [menu, setMenu] = useState<Menu>({ categories: [], products: [] }),
    [edit, setEdit] = useState<AdminProduct | null | undefined>(undefined),
    [categoryEdit, setCategoryEdit] = useState<AdminCategory | null | undefined>(undefined),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [search, setSearch] = useState(''),
    [review, setReview] = useState(false);
  async function load() {
    try {
      setMenu(await api('/api/admin/menu'));
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial external menu fetch.
    void load();
  }, []);
  return (
    <main className="content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">THE MENU / ADMINISTRATION</div>
          <h1>Keep the night moving.</h1>
        </div>
        <div className="actions">
          <button onClick={() => setCategoryEdit(null)}>Add category</button>
          <button className="primary" onClick={() => setEdit(null)}>
            Add product
          </button>
        </div>
      </div>
      <div className="notice">
        <strong>Menu review</strong>
        <p>
          Conflicting beverages need explicit confirmation. Seasonal items need a numeric price. The
          two “Schezwan ₹20 extra” rules are unresolved and have no product button. Source prices
          are preserved separately.
        </p>
        <button onClick={() => setReview(!review)}>
          {review ? 'Show all products' : 'Show items needing review'}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {edit !== undefined && (
        <ProductEditor
          key={edit?.id ?? 'new'}
          product={edit}
          categories={menu.categories}
          cancel={() => setEdit(undefined)}
          done={() => {
            setEdit(undefined);
            setMessage('Product saved. Existing bills keep their original prices.');
            void load();
          }}
        />
      )}
      {categoryEdit !== undefined && (
        <CategoryEditor
          key={categoryEdit?.id ?? 'new'}
          category={categoryEdit}
          cancel={() => setCategoryEdit(undefined)}
          done={() => {
            setCategoryEdit(undefined);
            setMessage('Category saved.');
            void load();
          }}
        />
      )}
      <div className="filter-bar">
        <label>
          Find a product
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product name…"
          />
        </label>
        <label>
          Edit category
          <select
            value=""
            onChange={(e) => setCategoryEdit(menu.categories.find((c) => c.id === e.target.value))}
          >
            <option value="">Choose category…</option>
            {menu.categories.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
                {!c.active ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Unit</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {menu.products
              .filter(
                (p) =>
                  p.name.toLowerCase().includes(search.toLowerCase()) &&
                  (!review || p.needs_confirmation || p.price_paise === null),
              )
              .map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{menu.categories.find((c) => c.id === p.category_id)?.name}</td>
                  <td>{p.price_paise === null ? 'Unpriced' : formatMoney(p.price_paise)}</td>
                  <td>{p.unit_label}</td>
                  <td>
                    <span className="pill">
                      {p.needs_confirmation
                        ? 'Needs confirmation'
                        : p.active
                          ? 'Active'
                          : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => setEdit(p)}>Edit</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
function ProductEditor({
  product,
  categories,
  cancel,
  done,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  cancel: () => void;
  done: () => void;
}) {
  const [price, setPrice] = useState(
      product?.price_paise === null || !product ? '' : rupeesInput(String(product.price_paise)),
    ),
    [active, setActive] = useState(product?.active ?? false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const body = {
        name: f.get('name'),
        category_id: f.get('category_id'),
        unit_label: f.get('unit_label'),
        price_paise: price.trim() ? parseRupees(price) : null,
        active,
        needs_confirmation: product?.needs_confirmation ? !confirm : false,
        sort_order: Number(f.get('sort_order')),
      };
      await api(
        `/api/admin/products${product ? '/' + product.id : ''}`,
        body,
        product ? 'PATCH' : 'POST',
      );
      done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel editor" onSubmit={save}>
      <h2>{product ? 'Edit product' : 'Add product'}</h2>
      {product?.source_notes && <p className="notice">{product.source_notes}</p>}
      <div className="form-grid">
        <label>
          Name
          <input name="name" defaultValue={product?.name} required maxLength={160} />
        </label>
        <label>
          Category
          <select name="category_id" defaultValue={product?.category_id} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.active ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label>
          Price (₹)
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Unpriced"
          />
          <small>
            Previous:{' '}
            {product?.price_paise === null || !product
              ? 'Unpriced'
              : formatMoney(product.price_paise)}{' '}
            → New: ₹{price || 'unpriced'}
          </small>
        </label>
        <label>
          Serving unit
          <input
            name="unit_label"
            defaultValue={product?.unit_label ?? '1 serving'}
            required
            maxLength={40}
          />
        </label>
        <label>
          Sort order
          <input
            name="sort_order"
            type="number"
            min="0"
            max="100000"
            defaultValue={product?.sort_order ?? 0}
            required
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active for billing
        </label>
      </div>
      {product?.needs_confirmation && (
        <label className="checkbox">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          I have reviewed the source conflict and confirm this product name and event price.
        </label>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy || (active && (!price || (product?.needs_confirmation && !confirm)))}
        >
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </form>
  );
}
function CategoryEditor({
  category,
  cancel,
  done,
}: {
  category: AdminCategory | null;
  cancel: () => void;
  done: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api(
        `/api/admin/categories${category ? '/' + category.id : ''}`,
        {
          name: f.get('name'),
          group_type: f.get('group_type'),
          sort_order: Number(f.get('sort_order')),
          active: f.get('active') === 'on',
        },
        category ? 'PATCH' : 'POST',
      );
      done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel editor" onSubmit={save}>
      <h2>{category ? 'Edit category' : 'Add category'}</h2>
      <div className="form-grid">
        <label>
          Name
          <input name="name" defaultValue={category?.name} required maxLength={100} />
        </label>
        <label>
          Group
          <select name="group_type" defaultValue={category?.group_type ?? 'FOOD'}>
            {['ALCOHOL', 'FOOD', 'BEVERAGE'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sort order
          <input
            name="sort_order"
            type="number"
            min="0"
            max="100000"
            defaultValue={category?.sort_order ?? 0}
            required
          />
        </label>
        <label className="checkbox">
          <input name="active" type="checkbox" defaultChecked={category?.active ?? true} />
          Active
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={cancel} disabled={busy}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save category'}
        </button>
      </div>
    </form>
  );
}
