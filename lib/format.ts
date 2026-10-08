const moneyFormat = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' });
// Calendar dates (check-in, check-out, attendance day) are stored at UTC midnight,
// so formatting them in local time would shift them a day west of UTC.
const dateFormat = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat('en-ET', { dateStyle: 'medium', timeStyle: 'short' });

type DateInput = string | Date | null | undefined;

function parse(d: DateInput): Date | null {
  if (d == null || d === '') return null;
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
}

export function money(n: number): string {
  return moneyFormat.format(n);
}

export function date(d: DateInput): string {
  const x = parse(d);
  return x ? dateFormat.format(x) : '—';
}

export function dateTime(d: DateInput): string {
  const x = parse(d);
  return x ? dateTimeFormat.format(x) : '—';
}
