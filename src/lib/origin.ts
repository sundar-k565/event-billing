import { HttpError } from './permissions';
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  let valid = false;
  try {
    const supplied = new URL(origin ?? '');
    // Next can normalize request.url to localhost behind its proxy. Host retains the
    // incoming authority; unlike forwarded-host, it is also used for HTTP routing.
    valid = ['http:', 'https:'].includes(supplied.protocol) && supplied.host === host;
  } catch {
    /* Missing, opaque or malformed origins are rejected. */
  }
  if (!valid) throw new HttpError(403, 'Invalid request origin');
}
