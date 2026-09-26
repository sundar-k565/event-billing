import { z } from 'zod';
import { requireSession } from '@/lib/server/auth';
import { endpoint, readBody } from '@/lib/server/http';
import {
  getBill,
  getMenu,
  getReport,
  listBills,
  getMenuRecords,
  getUsers,
  saveRecord,
  getSettings,
  getAudit,
} from '@/lib/server/data';
import { cookies } from 'next/headers';
import { pool } from '@/lib/server/db';
import { authenticate, SESSION_COOKIE, SESSION_SECONDS } from '@/lib/local-auth';
import { hashPassword, tokenHash } from '@/lib/password';
import { HttpError } from '@/lib/permissions';
import {
  billSchema,
  categorySchema,
  dateSchema,
  newUserSchema,
  productSchema,
  settingsSchema,
  userSchema,
  uuid,
} from '@/lib/validation';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
async function dispatch(request: Request, context: Context) {
  const { path } = await context.params;
  const route = path.join('/');
  const method = request.method;
  if (route === 'auth/login' && method === 'POST') {
    const body = z
      .object({ email: z.email(), password: z.string().min(1).max(128) })
      .strict()
      .parse(await readBody(request));
    const store = await cookies();
    const { token, profile } = await authenticate(
      pool(),
      body.email,
      body.password,
      store.get(SESSION_COOKIE)?.value,
    );
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.COOKIE_SECURE !== 'false',
      maxAge: SESSION_SECONDS,
    });
    return { redirect: profile.role === 'ADMIN' ? '/admin' : '/pos' };
  }
  if (route === 'auth/logout' && method === 'POST') {
    await readBody(request);
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token)
      await pool().query('delete from auth.sessions where token_hash=$1', [tokenHash(token)]);
    store.delete(SESSION_COOKIE);
    return { ok: true };
  }
  const admin = path[0] === 'admin' || path[0] === 'reports' || path[2] === 'void';
  const { db, profile } = await requireSession(admin);
  if (route === 'menu' && method === 'GET') return { categories: await getMenu(db) };
  if (route === 'bills' && method === 'POST') {
    const body = billSchema.parse(await readBody(request));
    return {
      bill: await db.scalar('select public.create_bill($1,$2,$3) as result', [
        body.idempotencyKey,
        body.paymentMethod,
        JSON.stringify(body.items),
      ]),
    };
  }
  if (route === 'bills' && method === 'GET') {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const filters = z
      .object({
        date: dateSchema.optional(),
        paymentMethod: z.enum(['CASH', 'UPI', 'CARD']).optional(),
        status: z.enum(['COMPLETED', 'VOID']).optional(),
        billNumber: z
          .string()
          .regex(/^WAAAT-\d{4,}$/i)
          .optional(),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(query);
    return listBills(db, filters);
  }
  if (path[0] === 'bills' && path.length === 2 && method === 'GET')
    return { bill: await getBill(db, uuid.parse(path[1])) };
  if (path[0] === 'bills' && path[2] === 'void' && path.length === 3 && method === 'POST') {
    const body = z
      .object({ reason: z.string().trim().min(1).max(500) })
      .strict()
      .parse(await readBody(request));
    return {
      bill: await db.scalar('select public.void_bill($1,$2) as result', [
        uuid.parse(path[1]),
        body.reason,
      ]),
    };
  }
  if (route === 'reports/daily' && method === 'GET')
    return getReport(db, dateSchema.parse(new URL(request.url).searchParams.get('date')));
  if (route === 'admin/menu' && method === 'GET') {
    return getMenuRecords(db);
  }
  if (
    path[0] === 'admin' &&
    ['products', 'categories'].includes(path[1]) &&
    ['POST', 'PATCH'].includes(method) &&
    path.length === (method === 'POST' ? 2 : 3)
  ) {
    const schema = path[1] === 'products' ? productSchema : categorySchema;
    const body =
      method === 'PATCH'
        ? schema.partial().parse(await readBody(request))
        : schema.parse(await readBody(request));
    return {
      record: await saveRecord(
        db,
        path[1] as 'products' | 'categories',
        body,
        method === 'POST' ? undefined : uuid.parse(path[2]),
      ),
    };
  }
  if (route === 'admin/users' && method === 'GET') {
    return { users: await getUsers(db) };
  }
  if (route === 'admin/users' && method === 'POST') {
    const body = newUserSchema.parse(await readBody(request));
    return {
      id: await db.scalar('select public.create_local_user($1,$2,$3) as result', [
        body.email,
        await hashPassword(body.password),
        body.display_name,
      ]),
    };
  }
  if (path[0] === 'admin' && path[1] === 'users' && path.length === 3 && method === 'PATCH') {
    const body = userSchema.parse(await readBody(request));
    await db.query('select public.manage_user($1,$2,$3,$4)', [
      uuid.parse(path[2]),
      body.role,
      body.active,
      body.display_name,
    ]);
    return { ok: true };
  }
  if (route === 'admin/settings' && method === 'GET') {
    return getSettings(db);
  }
  if (route === 'admin/settings' && method === 'PATCH') {
    const body = settingsSchema.parse(await readBody(request));
    return saveRecord(db, 'settings', body, true);
  }
  if (route === 'admin/audit' && method === 'GET') {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .default(1)
      .parse(new URL(request.url).searchParams.get('page') ?? undefined);
    return getAudit(db, page);
  }
  if (route === 'me' && method === 'GET') return { profile };
  throw new HttpError(404, 'Endpoint not found');
}
export function GET(request: Request, context: Context) {
  return endpoint(() => dispatch(request, context));
}
export function POST(request: Request, context: Context) {
  return endpoint(() => dispatch(request, context));
}
export function PATCH(request: Request, context: Context) {
  return endpoint(() => dispatch(request, context));
}
