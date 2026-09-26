import type { Profile } from './types';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function authorize(profile: Profile | null, admin = false): Profile {
  if (!profile) throw new HttpError(401, 'Please sign in again. Your cart is kept in this tab.');
  if (!profile.active || !['ADMIN', 'STAFF'].includes(profile.role))
    throw new HttpError(403, 'Account is inactive. Contact the administrator.');
  if (admin && profile.role !== 'ADMIN') throw new HttpError(403, 'Administrator access required');
  return profile;
}
