function validateRatingPayload(body = {}) {
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { error: 'Rating must be a whole number from 1 to 5' };
  }
  const comment = body.comment == null ? null : String(body.comment).trim();
  if (comment && comment.length > 500) {
    return { error: 'Review comment must be 500 characters or fewer' };
  }
  return { stars, comment: comment || null };
}

function canRateReservation(userId, reservation) {
  return Boolean(
    reservation
    && Number(reservation.customer_id) === Number(userId)
    && reservation.status === 'Completed'
  );
}

function canRateOrder(shopId, order) {
  return Boolean(
    order
    && Number(order.shop_id) === Number(shopId)
    && order.status === 'Delivered'
  );
}

module.exports = { validateRatingPayload, canRateReservation, canRateOrder };

