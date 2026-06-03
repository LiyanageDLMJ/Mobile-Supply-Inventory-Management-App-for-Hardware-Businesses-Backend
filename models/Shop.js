const supabase = require('../config/supabase');

class Shop {
  static async create(shopData) {
    const {
      ownerId, shopName, businessRegNumber, description, phone, email, address,
      city, province, postalCode, openingTime, closingTime, workingDays,
      latitude, longitude,
    } = shopData;

    const insertData = {
      owner_id: ownerId,
      shop_name: shopName,
      business_reg_number: businessRegNumber,
      description: description || null,
      phone: phone || '',   // empty string guards against NOT NULL DB constraint
      email: email || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postal_code: postalCode || null,
      opening_time: openingTime || null,
      closing_time: closingTime || null,
      working_days: workingDays || null,
      // Shops are visible to customers by default. Unverified owners can't add
      // products yet (verification gate), so an empty shop won't appear in
      // browse/search anyway — but the flag must be true for it to ever show.
      is_active: true,
    };
    // Only include location if the columns exist (migration has been run)
    if (latitude != null && longitude != null) {
      insertData.latitude = parseFloat(latitude);
      insertData.longitude = parseFloat(longitude);
    }

    const { data, error } = await supabase.from('shops').insert(insertData).select().single();

    if (error) throw error;
    return data;
  }

  static async updateLocation(shopId, latitude, longitude) {
    const { data, error } = await supabase.from('shops')
      .update({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      })
      .eq('id', shopId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findByOwnerId(ownerId) {
    const { data, error } = await supabase.from('shops').select('*').eq('owner_id', ownerId).maybeSingle();
    if (error) {
      // Location columns may not exist yet — retry with explicit safe column list
      if (error.message && error.message.includes('latitude')) {
        const { data: safeData, error: safeError } = await supabase.from('shops')
          .select('id, owner_id, shop_name, business_reg_number, description, phone, email, address, city, province, postal_code, opening_time, closing_time, working_days, is_active, created_at, updated_at')
          .eq('owner_id', ownerId).maybeSingle();
        if (safeError) throw safeError;
        return safeData;
      }
      throw error;
    }
    return data;
  }

  static async updateLoyaltyPoints(shopId, points) {
    const { data: current, error: fetchError } = await supabase.from('shops')
      .select('loyalty_points').eq('id', shopId).single();
    if (fetchError) throw fetchError;

    const newPoints = (current.loyalty_points || 0) + points;
    const newTier =
      newPoints >= 5000 ? 'Platinum' :
      newPoints >= 2000 ? 'Gold' :
      newPoints >= 500  ? 'Silver' : 'Bronze';

    const { data, error } = await supabase.from('shops')
      .update({ loyalty_points: newPoints, loyalty_tier: newTier })
      .eq('id', shopId).select().single();
    if (error) throw error;
    return data;
  }
}

module.exports = Shop;
