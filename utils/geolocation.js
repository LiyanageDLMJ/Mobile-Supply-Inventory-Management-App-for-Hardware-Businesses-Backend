// Haversine formula to calculate distance between two geographic points in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c; // Distance in kilometers
}

// Validate if coordinates are within valid ranges
function validateCoordinates(lat, lon) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || isNaN(longitude)) {
    return { valid: false, error: 'Coordinates must be numbers' };
  }

  if (latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }

  if (longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true, latitude, longitude };
}

// Find locations within a given radius (in km) from a center point
function findWithinRadius(centerLat, centerLon, locations, radiusKm) {
  return locations
    .map(location => ({
      ...location,
      distance_km: calculateDistance(
        centerLat,
        centerLon,
        location.latitude,
        location.longitude
      ),
    }))
    .filter(location => location.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
}

module.exports = {
  calculateDistance,
  validateCoordinates,
  findWithinRadius,
};
