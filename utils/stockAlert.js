const Notification = require('../models/Notification');

/**
 * Fire a low-stock notification ONLY when stock crosses the threshold boundary
 * (from above it to at/below it). This prevents spamming the owner on every
 * single decrement once they're already below the line.
 *
 * @param {Object}  opts
 * @param {number}  opts.userId        Who to notify (shop owner / supplier user id)
 * @param {string}  opts.productName
 * @param {number}  opts.newQty        Quantity AFTER the change
 * @param {number}  opts.threshold     Low-stock threshold (null = disabled)
 * @param {number}  [opts.prevQty]     Quantity BEFORE the change. If omitted, we
 *                                     always notify when at/below threshold (used
 *                                     on create, where there's no "before").
 * @param {boolean} [opts.isSupplier]  Tailors the message wording.
 */
async function maybeNotifyLowStock({ userId, productName, newQty, threshold, prevQty, isSupplier = false }) {
  if (threshold === null || threshold === undefined) return;          // alerts disabled
  if (newQty > threshold) return;                                     // still healthy

  // Crossing guard: if we know the previous quantity and it was ALREADY
  // at/below the threshold, the owner has already been told — stay quiet.
  if (prevQty !== undefined && prevQty <= threshold) return;

  const isOut = newQty <= 0;
  const title = isOut ? 'Out of Stock' : 'Low Stock Alert';
  const message = isOut
    ? `"${productName}" is now OUT OF STOCK. ${isSupplier ? 'Restock to keep accepting orders.' : 'Restock soon or reorder from a supplier.'}`
    : `"${productName}" is low on stock (${newQty} remaining, alert set at ${threshold}). ${isSupplier ? 'Consider restocking.' : 'Consider reordering from a supplier.'}`;

  try {
    await Notification.create({ userId, type: 'LOW_STOCK', title, message });
  } catch (err) {
    console.error('Low-stock notification failed:', err.message);
  }
}

module.exports = { maybeNotifyLowStock };
