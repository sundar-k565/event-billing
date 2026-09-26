export function indiaDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function dayBounds(date: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Use YYYY-MM-DD');
  const start = new Date(`${date}T00:00:00+05:30`);
  if (!Number.isFinite(start.getTime()) || indiaDate(start) !== date)
    throw new Error('Invalid date');
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}
export function indiaTime(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
