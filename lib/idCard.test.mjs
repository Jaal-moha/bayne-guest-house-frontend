import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centerCrop, pdfFilename } from './idCard.ts';

test('centerCrop trims the sides of a landscape image', () => {
  assert.deepEqual(centerCrop(1600, 900), { sx: 450, sy: 0, sw: 700, sh: 900 });
});

test('centerCrop trims top and bottom of a tall image', () => {
  assert.deepEqual(centerCrop(700, 1200), { sx: 0, sy: 150, sw: 700, sh: 900 });
});

test('centerCrop keeps an image already at 7:9 whole', () => {
  assert.deepEqual(centerCrop(420, 540), { sx: 0, sy: 0, sw: 420, sh: 540 });
});

test('centerCrop keeps the crop inside the source for odd sizes', () => {
  for (const [w, h] of [[1001, 999], [333, 1001], [3, 1000], [1000, 3]]) {
    const { sx, sy, sw, sh } = centerCrop(w, h);
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= w && sy + sh <= h, `${w}x${h}`);
  }
});

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
