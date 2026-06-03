const supabase = require('../config/supabase');

class Supplier {
  static async create(supplierData) {
    const {
      userId, companyName, businessRegNumber, contactPerson, phone, email,
      address, city, province, postalCode, categories, description,
      latitude, longitude,
    } = supplierData;

    const insertData = {
      user_id: userId,
      company_name: companyName,
      business_reg_number: businessRegNumber,
      contact_person: contactPerson || null,
      phone: phone || '',   // empty string guards against NOT NULL DB constraint
      email: email || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postal_code: postalCode || null,
      categories: categories || null,
      description: description || null,
      is_active: true,
    };
    // Only include location if the columns exist (migration has been run)
    if (latitude != null && longitude != null) {
      insertData.latitude = parseFloat(latitude);
      insertData.longitude = parseFloat(longitude);
    }

    const { data, error } = await supabase.from('suppliers').insert(insertData).select().single();

    if (error) throw error;
    return data;
  }

  static async updateLocation(supplierId, latitude, longitude) {
    const { data, error } = await supabase.from('suppliers')
      .update({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      })
      .eq('id', supplierId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async findAll() {
    const { data, error } = await supabase.from('suppliers')
      .select('*').eq('is_active', true).order('company_name');
    if (error) {
      if (error.message && error.message.includes('latitude')) {
        const { data: safeData, error: safeError } = await supabase.from('suppliers')
          .select('id, user_id, company_name, business_reg_number, description, phone, email, address, city, province, postal_code, is_active, created_at, updated_at')
          .eq('is_active', true).order('company_name');
        if (safeError) throw safeError;
        return safeData || [];
      }
      throw error;
    }
    return data || [];
  }

  static async findByUserId(userId) {
    const { data, error } = await supabase.from('suppliers').select('*').eq('user_id', userId).maybeSingle();
    if (error) {
      // Location columns may not exist yet — retry with explicit safe column list
      if (error.message && error.message.includes('latitude')) {
        const { data: safeData, error: safeError } = await supabase.from('suppliers')
          .select('id, user_id, company_name, business_reg_number, description, phone, email, address, city, province, postal_code, is_active, created_at, updated_at')
          .eq('user_id', userId).maybeSingle();
        if (safeError) throw safeError;
        return safeData;
      }
      throw error;
    }
    return data;
  }
}

module.exports = Supplier;
