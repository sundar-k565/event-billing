import 'server-only';
import type { Database } from './db';
import type { Bill, Category, Report, AdminCategory, AdminProduct, Profile } from '@/lib/types';
import { dayBounds } from '@/lib/date';
import { HttpError } from '@/lib/permissions';

export async function getMenu(db: Database): Promise<Category[]> {
  const { categories, products } = await getMenuRecords(db);
  return categories
    .filter((c) => c.active)
    .map((c) => ({
      id: c.id,
      name: c.name,
      groupType: c.group_type,
      products: products
        .filter(
          (p) =>
            p.category_id === c.id && p.active && !p.needs_confirmation && p.price_paise !== null,
        )
        .map((p) => ({
          id: p.id,
          name: p.name,
          pricePaise: String(p.price_paise),
          unitLabel: p.unit_label,
        })),
    }))
    .filter((c) => c.products.length);
}
export async function getMenuRecords(db: Database) {
  const [categories, products] = await Promise.all([
    db.query<AdminCategory>('select * from public.categories order by sort_order,name,id'),
    db.query<AdminProduct>('select * from public.products order by sort_order,name,id'),
  ]);
  return { categories: categories.rows, products: products.rows };
}
export async function getUsers(db: Database) {
  return (
    await db.query<Profile>(
      'select id,display_name,email,role,active from public.profiles order by display_name,id',
    )
  ).rows;
}
export async function getBill(db: Database, id: string): Promise<Bill> {
  const bill = await db.scalar<Bill | null>('select public.bill_json($1) as result', [id]);
  if (!bill) throw new HttpError(404, 'Bill not found');
  return bill;
}
export async function getReport(db: Database, date: string): Promise<Report> {
  dayBounds(date);
  return db.scalar<Report>('select public.daily_report($1) as result', [date]);
}
export async function listBills(
  db: Database,
  filters: {
    date?: string;
    paymentMethod?: string;
    status?: string;
    billNumber?: string;
    page: number;
  },
) {
  const values: unknown[] = [];
  const clauses: string[] = [];
  const add = (column: string, operator: string, value: unknown) => {
    values.push(value);
    clauses.push(`${column} ${operator} $${values.length}`);
  };
  if (filters.date) {
    const { start, end } = dayBounds(filters.date);
    add('created_at', '>=', start);
    add('created_at', '<', end);
  }
  if (filters.paymentMethod) add('payment_method', '=', filters.paymentMethod);
  if (filters.status) add('status', '=', filters.status);
  if (filters.billNumber) add('bill_number', '=', filters.billNumber.toUpperCase());
  const where = clauses.length ? ' where ' + clauses.join(' and ') : '';
  return db.scalar<{ bills: Bill[]; total: number; page: number }>(
    `with filtered as (
    select * from public.bills${where}
  ), page_rows as (
    select id,bill_number,created_at,total_paise,payment_method,status from filtered
    order by created_at desc,id limit 50 offset $${values.length + 1}
  ) select jsonb_build_object('bills',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'billNumber',bill_number,'createdAt',created_at,'totalPaise',total_paise::text,
    'paymentMethod',payment_method,'status',status) order by created_at desc,id) from page_rows),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',$${values.length + 2}::int) as result`,
    [...values, (filters.page - 1) * 50, filters.page],
  );
}
const fields = {
  products: [
    'name',
    'category_id',
    'price_paise',
    'unit_label',
    'active',
    'needs_confirmation',
    'sort_order',
  ],
  categories: ['name', 'group_type', 'sort_order', 'active'],
  settings: ['display_name', 'receipt_footer'],
};
export async function saveRecord(
  db: Database,
  table: keyof typeof fields,
  body: Record<string, unknown>,
  id?: string | boolean,
) {
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !fields[table].includes(key)))
    throw new HttpError(422, 'No valid fields to save');
  const values = keys.map((key) => body[key]);
  const sql =
    id === undefined
      ? `insert into public.${table}(${keys.join(',')}) values(${keys.map((_, i) => `$${i + 1}`).join(',')}) returning *`
      : `update public.${table} set ${keys.map((key, i) => `${key}=$${i + 1}`).join(',')} where id=$${values.length + 1} returning *`;
  if (id !== undefined) values.push(id);
  const result = (await db.query(sql, values)).rows[0];
  if (!result) throw new HttpError(404, 'Record not found');
  return result;
}
export async function getSettings(db: Database) {
  return (await db.query('select display_name,receipt_footer from public.settings where id=true'))
    .rows[0];
}
export async function getAudit(db: Database, page: number) {
  return db.scalar(
    `select jsonb_build_object('logs',coalesce((select jsonb_agg(t order by t.created_at desc,t.id) from
    (select * from public.audit_logs order by created_at desc,id limit 50 offset $1) t),'[]'::jsonb),
    'total',(select count(*) from public.audit_logs),'page',$2::int) as result`,
    [(page - 1) * 50, page],
  );
}
