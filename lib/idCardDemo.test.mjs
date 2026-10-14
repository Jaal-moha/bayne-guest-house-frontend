import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ID_CARD_OPTIONS, demoQuery, summaryLine, wordmarkOf } from './idCardDemo.ts';

test('summaryLine reads the defaults the way the client sees them', () => {
  assert.equal(summaryLine(DEFAULT_ID_CARD_OPTIONS), 'Photo: passport · Back: white · Per page: 1 · Wordmark: ALMIS HOTEL');
});

test('summaryLine names the tinted back and three per page', () => {
  const options = { photo: 'compact', back: 'tint', wordmark: 'almis guest house', perPage: 3 };
  assert.equal(summaryLine(options), 'Photo: compact · Back: tinted · Per page: 3 · Wordmark: ALMIS GUEST HOUSE');
});

test('wordmarkOf trims, caps at 24 characters and uppercases', () => {
  assert.equal(wordmarkOf('  bayne hotel  '), 'BAYNE HOTEL');
  assert.equal(wordmarkOf('a'.repeat(30)), 'A'.repeat(24));
});

test('wordmarkOf falls back to the default when blank', () => {
  assert.equal(wordmarkOf('   '), 'ALMIS HOTEL');
});

test('demoQuery sends every option and the staff ids in order', () => {
  const q = new URLSearchParams(demoQuery({ ...DEFAULT_ID_CARD_OPTIONS, back: 'tint', wordmark: ' x y ' }, [3, 1, 2]));
  assert.deepEqual(Object.fromEntries(q), { ids: '3,1,2', photo: 'passport', back: 'tint', wordmark: 'X Y', perPage: '1' });
});
