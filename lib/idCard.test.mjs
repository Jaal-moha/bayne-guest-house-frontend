import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pdfFilename } from './idCard.ts';

test('pdfFilename reads the quoted filename from Content-Disposition', () => {
  assert.equal(pdfFilename('inline; filename="staff-EMP-000123.pdf"', 7), 'staff-EMP-000123.pdf');
});

test('pdfFilename reads an unquoted filename', () => {
  assert.equal(pdfFilename('attachment; filename=staff-EMP-9.pdf', 7), 'staff-EMP-9.pdf');
});

test('pdfFilename falls back to the staff id without a usable header', () => {
  assert.equal(pdfFilename(undefined, 7), 'staff-7.pdf');
  assert.equal(pdfFilename('inline', 7), 'staff-7.pdf');
});
