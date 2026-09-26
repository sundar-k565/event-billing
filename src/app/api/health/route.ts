import { pool } from '@/lib/server/db';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    await pool().query('select * from auth.session_profile($1)', ['health-check']);
    return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
