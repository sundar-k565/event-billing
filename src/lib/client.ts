export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : method,
    cache: 'no-store',
    signal: AbortSignal.timeout(25000),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.error ?? 'Request failed');
  return data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.';
}
