import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFailure, refetching } from './useList.ts';

test('a refetch keeps the rows and marks them as updating', () => {
  assert.deepEqual(refetching({ kind: 'ready', rows: [1, 2], updating: false }), { kind: 'ready', rows: [1, 2], updating: true });
});

test('a refetch after a failure shows loading', () => {
  assert.deepEqual(refetching({ kind: 'error', message: "Couldn't load x" }), { kind: 'loading' });
  assert.deepEqual(refetching({ kind: 'forbidden' }), { kind: 'loading' });
});

test('a 403 is forbidden, other failures are retryable errors', () => {
  const http = (status) => Object.assign(new Error('x'), { isAxiosError: true, response: { status } });
  assert.deepEqual(loadFailure('payments', http(403)), { kind: 'forbidden' });
  assert.deepEqual(loadFailure('payments', http(500)), { kind: 'error', message: "Couldn't load payments" });
});
