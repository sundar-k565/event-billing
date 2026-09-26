import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from '@/lib/permissions';
import { assertSameOrigin } from '@/lib/origin';
export function dbError(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.code === '42501') throw new HttpError(403, 'Permission denied');
  if (error.code === '23505')
    throw new HttpError(409, 'Already exists or this submission key was used for another request.');
  if (['22023', '22P02', '23514', '23503'].includes(error.code ?? ''))
    throw new HttpError(
      422,
      error.code === '22023'
        ? error.message
        : 'Invalid values. Check price, category, active and confirmation settings.',
    );
  console.error('Database operation failed:', error.code);
  throw new HttpError(503, 'Could not confirm the operation. Retry with the same request.');
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function endpoint(work: () => Promise<unknown>) {
  try {
    return json(await work());
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return json({ error: 'Invalid request. Check the entered values.' }, 422);
    console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'Could not confirm the operation. Retry with the same request.' }, 503);
  }
}
export function sameOrigin(request: Request) {
  assertSameOrigin(request);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'JSON required');
}
export async function readBody(request: Request) {
  sameOrigin(request);
  if (Number(request.headers.get('content-length')) > 65536)
    throw new HttpError(413, 'Request too large');
  const text = await request.text();
  if (text.length > 65536) throw new HttpError(413, 'Request too large');
  return JSON.parse(text);
}
