const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const {
      firstName, lastName, username, email, phone, password, accountType,
      businessName, businessRegNumber, nicNumber, address, city, province, postalCode,
    } = userData;

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Customers don't need verification; business roles start NOT_SUBMITTED
    const initialStatus =
      accountType === 'CUSTOMER' ? 'VERIFIED' : 'NOT_SUBMITTED';

    const { data, error } = await supabase.from('users').insert({
      first_name: firstName,
      last_name: lastName,
      username,
      email,
      phone: phone || null,
      password: hashedPassword,
      role: accountType,
      business_name: businessName || null,
      business_reg_number: businessRegNumber || null,
      nic_number: nicNumber || null,
      address: address || null,
      city: city || null,
      province: province || null,
      postal_code: postalCode || null,
      verification_status: initialStatus,
    }).select('id, first_name, last_name, username, email, phone, role, business_name, business_reg_number, nic_number, verification_status, created_at').single();

    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('users_email_key') || error.message.includes('email')) throw new Error('Email already exists');
        if (error.message.includes('users_username_key') || error.message.includes('username')) throw new Error('Username already exists');
        if (error.message.includes('business_reg_number')) throw new Error('Business registration number already exists');
        if (error.message.includes('nic_number')) throw new Error('NIC number already exists');
      }
      throw error;
    }
    return data;
  }

  static async findByEmail(email) {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findByUsername(username) {
    const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findByBusinessRegNumber(businessRegNumber) {
    const { data, error } = await supabase.from('users').select('*').eq('business_reg_number', businessRegNumber).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findByNIC(nicNumber) {
    const { data, error } = await supabase.from('users').select('*').eq('nic_number', nicNumber).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async findById(id) {
    const { data, error } = await supabase.from('users')
      .select('id, first_name, last_name, username, email, phone, role, profile_image_url, loyalty_points, loyalty_tier, verification_status, rejection_reason, submitted_at, verified_at, created_at')
      .eq('id', id).maybeSingle();
    if (error) {
      // Verification columns may not exist yet — fall back to legacy column list
      if (error.message && error.message.includes('verification_status')) {
        const { data: safe, error: safeErr } = await supabase.from('users')
          .select('id, first_name, last_name, username, email, phone, role, profile_image_url, loyalty_points, loyalty_tier, created_at')
          .eq('id', id).maybeSingle();
        if (safeErr) throw safeErr;
        if (safe) safe.profile_image = safe.profile_image_url;
        if (safe) safe.verification_status = 'VERIFIED';
        return safe;
      }
      throw error;
    }
    if (data) data.profile_image = data.profile_image_url;
    return data;
  }

  static async findPasswordById(id) {
    const { data, error } = await supabase.from('users')
      .select('id, password')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  static async getVerificationState(id) {
    const { data, error } = await supabase.from('users')
      .select('verification_status, verification_docs, rejection_reason, submitted_at, verified_at')
      .eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async submitVerification(id, docs) {
    const { data, error } = await supabase.from('users')
      .update({
        verification_status: 'PENDING',
        verification_docs: docs,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, verification_status, submitted_at')
      .single();
    if (error) throw error;
    return data;
  }

  static async approveVerification(id, adminId) {
    const { data, error } = await supabase.from('users')
      .update({
        verification_status: 'VERIFIED',
        verified_at: new Date().toISOString(),
        verified_by: adminId,
        rejection_reason: null,
      })
      .eq('id', id)
      .select('id, verification_status, verified_at')
      .single();
    if (error) throw error;
    return data;
  }

  static async rejectVerification(id, adminId, reason) {
    const { data, error } = await supabase.from('users')
      .update({
        verification_status: 'REJECTED',
        rejection_reason: reason,
        verified_by: adminId,
      })
      .eq('id', id)
      .select('id, verification_status, rejection_reason')
      .single();
    if (error) throw error;
    return data;
  }

  static async listByVerificationStatus(status) {
    let query = supabase.from('users')
      .select('id, first_name, last_name, username, email, phone, role, business_name, business_reg_number, nic_number, verification_status, submitted_at, verified_at, rejection_reason, created_at')
      .in('role', ['SHOP_OWNER', 'SUPPLIER'])
      .order('submitted_at', { ascending: false, nullsFirst: false });
    if (status) query = query.eq('verification_status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // List all users across every role, with optional role filter + text search.
  // Used by the admin console's "Users" browser (not the verification workflow).
  static async listAll({ role, search } = {}) {
    let query = supabase.from('users')
      .select('id, first_name, last_name, username, email, phone, role, business_name, verification_status, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (role) query = query.eq('role', role);
    if (search) {
      const term = `%${search}%`;
      query = query.or(
        `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},username.ilike.${term},business_name.ilike.${term}`
      );
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  static async findAdminId() {
    const { data, error } = await supabase.from('users')
      .select('id').eq('role', 'ADMIN').limit(1).maybeSingle();
    if (error) throw error;
    return data ? data.id : null;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async hashPassword(plainPassword) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plainPassword, salt);
  }

  static async updatePassword(id, plainPassword) {
    const hashedPassword = await this.hashPassword(plainPassword);

    const { error } = await supabase.from('users')
      .update({
        password: hashedPassword,
        reset_token: null,
        reset_token_expiry: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  static async update(id, updates) {
    const { first_name, last_name, email, username, phone, profile_image } = updates;

    const updateData = { updated_at: new Date().toISOString() };
    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (email !== undefined) updateData.email = email;
    if (username !== undefined) updateData.username = username;
    if (phone !== undefined) updateData.phone = phone;
    if (profile_image !== undefined) updateData.profile_image_url = profile_image;

    const { data, error } = await supabase.from('users')
      .update(updateData)
      .eq('id', id)
      .select('id, first_name, last_name, username, email, phone, role, profile_image_url, updated_at')
      .single();

    if (error) throw error;
    if (data) data.profile_image = data.profile_image_url;
    return data;
  }
}

module.exports = User;
