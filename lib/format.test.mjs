import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, date, dateTime } from './format.ts';

const plain = (s) => s.replace(/\s/g, ' ');

test('money prints birr with thousands separator and two decimals', () => {
  assert.equal(plain(money(1500)), 'ETB 1,500.00');
});

test('money prints zero as birr', () => {
  assert.equal(plain(money(0)), 'ETB 0.00');
});

test('date keeps the calendar day of a UTC-midnight date', () => {
  assert.equal(date('2026-10-08T00:00:00.000Z'), 'Oct 8, 2026');
});

test('date and dateTime print a dash for missing or invalid input', () => {
  for (const f of [date, dateTime]) {
    assert.equal(f(null), '—');
    assert.equal(f(undefined), '—');
    assert.equal(f('not a date'), '—');
  }
});

test('dateTime includes the time', () => {
  assert.match(dateTime('2026-10-08T09:30:00.000Z'), /^Oct 8, 2026, \d{1,2}:\d{2}\s(AM|PM)$/);
});
