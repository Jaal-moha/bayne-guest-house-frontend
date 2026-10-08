import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, canSee, landingFor } from './permissions.ts';

const expectedLanding = {
  admin: '/dashboard',
  manager: '/dashboard',
  reception: '/dashboard',
  finance: '/dashboard',
  housekeeping: '/laundry',
  store: '/inventory',
  barista: '/inventory',
  security: null,
};

test('landingFor covers all eight backend roles', () => {
  assert.deepEqual([...ROLES].sort(), Object.keys(expectedLanding).sort());
  for (const role of ROLES) {
    assert.equal(landingFor(role), expectedLanding[role], role);
  }
});

test('every role with a page can see its landing page', () => {
  for (const role of ROLES) {
    const landing = landingFor(role);
    if (landing) assert.ok(canSee(role, landing), `${role} can see ${landing}`);
  }
});

test('the table resolves the old disagreements', () => {
  assert.ok(canSee('housekeeping', '/laundry'));
  assert.ok(canSee('reception', '/inventory'));
  assert.deepEqual(
    ROLES.filter((role) => canSee(role, '/attendance')),
    ['admin', 'manager', 'reception'],
  );
  assert.equal(canSee('store', '/bookings'), false);
});
