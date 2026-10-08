import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flowReducer, initialFlow, planSubmit } from './bookingFlow.ts';

const TODAY = '2026-10-08';
const run = (actions, state = initialFlow) => actions.reduce(flowReducer, state);

const newGuestToReview = [
  { type: 'chooseGuestKind', kind: 'new' },
  { type: 'editDraft', field: 'name', value: 'Abebe Kebede' },
  { type: 'editDraft', field: 'phone', value: '0911223344' },
  { type: 'next', today: TODAY },
  { type: 'editDate', field: 'checkIn', value: '2026-10-10', today: TODAY },
  { type: 'editDate', field: 'checkOut', value: '2026-10-12', today: TODAY },
  { type: 'pickRoom', roomId: 7 },
  { type: 'next', today: TODAY },
];

test('the flow walks guest, stay, review and sends only the DTO fields', () => {
  const state = run([
    { type: 'pickGuest', guestId: 3 },
    { type: 'next', today: TODAY },
    { type: 'editDate', field: 'checkIn', value: '2026-10-10', today: TODAY },
    { type: 'editDate', field: 'checkOut', value: '2026-10-12', today: TODAY },
    { type: 'pickRoom', roomId: 7 },
    { type: 'next', today: TODAY },
  ]);
  assert.equal(state.step, 'review');
  const plan = planSubmit(state, TODAY);
  assert.equal(plan.kind, 'ready');
  assert.deepEqual(plan.guest, { kind: 'existing', guestId: 3 });
  assert.deepEqual(plan.booking(3), { guestId: 3, roomId: 7, checkIn: '2026-10-10', checkOut: '2026-10-12' });
});

test('a new guest is posted once at submit', () => {
  const plan = planSubmit(run(newGuestToReview), TODAY);
  assert.equal(plan.guest.method, 'POST');
  assert.equal(plan.guest.path, '/guests');
  assert.deepEqual(plan.guest.body, { name: 'Abebe Kebede', phone: '0911223344' });
});

test('Back then Save with a saved guest yields a PATCH, not a POST', () => {
  const failed = run([
    ...newGuestToReview,
    { type: 'submitStarted' },
    { type: 'guestSaved', guestId: 41 },
    { type: 'submitFailed', message: 'Room is already booked in this date range' },
    { type: 'back' },
    { type: 'back' },
    { type: 'editDraft', field: 'name', value: 'Abebe K.' },
    { type: 'next', today: TODAY },
    { type: 'pickRoom', roomId: 7 },
    { type: 'next', today: TODAY },
  ]);
  assert.equal(failed.step, 'review');
  const plan = planSubmit(failed, TODAY);
  assert.equal(plan.guest.method, 'PATCH');
  assert.equal(plan.guest.path, '/guests/41');
  assert.equal(plan.guest.body.name, 'Abebe K.');
});

test('switching to existing and back keeps the created guest id', () => {
  const state = run([
    ...newGuestToReview,
    { type: 'guestSaved', guestId: 41 },
    { type: 'back' }, { type: 'back' },
    { type: 'chooseGuestKind', kind: 'existing' },
    { type: 'chooseGuestKind', kind: 'new' },
    { type: 'editDraft', field: 'name', value: 'Sara' },
    { type: 'editDraft', field: 'phone', value: '0911000000' },
    { type: 'next', today: TODAY },
    { type: 'next', today: TODAY },
  ]);
  assert.equal(planSubmit(state, TODAY).guest.method, 'PATCH');
});

test('a past check-in is flagged as typed and blocks Next', () => {
  const state = run([
    { type: 'pickGuest', guestId: 3 },
    { type: 'next', today: TODAY },
    { type: 'editDate', field: 'checkIn', value: '2026-10-07', today: TODAY },
  ]);
  assert.match(state.errors.checkIn, /past/);
  const after = run([
    { type: 'editDate', field: 'checkOut', value: '2026-10-09', today: TODAY },
    { type: 'pickRoom', roomId: 7 },
    { type: 'next', today: TODAY },
  ], state);
  assert.equal(after.step, 'stay');
  assert.match(after.errors.checkIn, /past/);
  assert.equal(planSubmit(after, TODAY).kind, 'invalid');
});

test('a zero-night stay is flagged and blocks Next', () => {
  const state = run([
    { type: 'pickGuest', guestId: 3 },
    { type: 'next', today: TODAY },
    { type: 'editDate', field: 'checkIn', value: '2026-10-10', today: TODAY },
    { type: 'editDate', field: 'checkOut', value: '2026-10-10', today: TODAY },
    { type: 'next', today: TODAY },
  ]);
  assert.equal(state.step, 'stay');
  assert.match(state.errors.checkOut, /one night/);
  assert.equal(state.errors.checkIn, undefined);
});

test('check-in today is allowed', () => {
  const state = run([
    { type: 'pickGuest', guestId: 3 },
    { type: 'next', today: TODAY },
    { type: 'editDate', field: 'checkIn', value: TODAY, today: TODAY },
    { type: 'editDate', field: 'checkOut', value: '2026-10-09', today: TODAY },
    { type: 'pickRoom', roomId: 7 },
    { type: 'next', today: TODAY },
  ]);
  assert.equal(state.step, 'review');
});

test('a review left open past midnight re-checks the dates at submit', () => {
  const state = run(newGuestToReview);
  const plan = planSubmit(state, '2026-10-11');
  assert.equal(plan.kind, 'invalid');
  assert.equal(plan.step, 'stay');
});

test('changing a date clears the picked room', () => {
  const state = run([
    { type: 'editDate', field: 'checkIn', value: '2026-10-10', today: TODAY },
    { type: 'editDate', field: 'checkOut', value: '2026-10-12', today: TODAY },
    { type: 'pickRoom', roomId: 7 },
    { type: 'editDate', field: 'checkOut', value: '2026-10-13', today: TODAY },
  ]);
  assert.equal(state.stay.roomId, null);
});

test('the guest step requires a pick or a name and phone', () => {
  assert.deepEqual(run([{ type: 'next', today: TODAY }]).errors, { guestId: 'Pick a guest.' });
  const blank = run([{ type: 'chooseGuestKind', kind: 'new' }, { type: 'next', today: TODAY }]);
  assert.equal(blank.step, 'guest');
  assert.ok(blank.errors.name && blank.errors.phone);
});
