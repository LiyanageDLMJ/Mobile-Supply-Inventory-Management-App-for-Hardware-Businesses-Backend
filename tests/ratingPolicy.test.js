const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRatingPayload,
  canRateReservation,
  canRateOrder,
} = require('../utils/ratingPolicy');

test('accepts a valid rating and trims its comment', () => {
  assert.deepEqual(validateRatingPayload({ stars: 5, comment: '  Excellent service  ' }), {
    stars: 5,
    comment: 'Excellent service',
  });
});

test('rejects stars outside the 1 to 5 range and non-whole values', () => {
  for (const stars of [0, 6, 2.5, 'bad', undefined]) {
    assert.match(validateRatingPayload({ stars }).error, /1 to 5/);
  }
});

test('rejects comments longer than 500 characters', () => {
  assert.match(validateRatingPayload({ stars: 4, comment: 'a'.repeat(501) }).error, /500/);
});

test('only the owning customer can rate a completed reservation', () => {
  assert.equal(canRateReservation(7, { customer_id: 7, status: 'Completed' }), true);
  assert.equal(canRateReservation(8, { customer_id: 7, status: 'Completed' }), false);
  assert.equal(canRateReservation(7, { customer_id: 7, status: 'Accepted' }), false);
});

test('only the owning shop can rate a delivered order', () => {
  assert.equal(canRateOrder(3, { shop_id: 3, status: 'Delivered' }), true);
  assert.equal(canRateOrder(4, { shop_id: 3, status: 'Delivered' }), false);
  assert.equal(canRateOrder(3, { shop_id: 3, status: 'Shipped' }), false);
});

