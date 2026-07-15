const supabase = require('../config/supabase');

class Rating {
  static async create(data) {
    const { data: rating, error } = await supabase.from('ratings').insert(data).select().single();
    if (error) throw error;
    return rating;
  }

  static async findById(id) {
    const { data, error } = await supabase.from('ratings').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  static async update(id, reviewerId, stars, comment) {
    let { data, error } = await supabase.from('ratings')
      .update({ stars, comment, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('reviewer_id', reviewerId)
      .eq('is_hidden', false)
      .select()
      .maybeSingle();
    if (error?.code === '42703') {
      ({ data, error } = await supabase.from('ratings')
        .update({ stars, comment, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('reviewer_id', reviewerId)
        .select()
        .maybeSingle());
    }
    if (error) throw error;
    return data;
  }

  static async findForTransactions(targetType, transactionIds) {
    if (!transactionIds.length) return new Map();
    const transactionColumn = targetType === 'SHOP' ? 'reservation_id' : 'order_id';
    const { data, error } = await supabase.from('ratings')
      .select('id, reviewer_id, stars, comment, created_at, updated_at, reservation_id, order_id')
      .eq('target_type', targetType)
      .in(transactionColumn, transactionIds);
    if (error?.code === '42P01') return new Map();
    if (error) throw error;
    return new Map((data || []).map(rating => [Number(rating[transactionColumn]), rating]));
  }

  static async getSummaryMap(targetType, targetIds) {
    const ids = [...new Set((targetIds || []).map(Number).filter(Number.isInteger))];
    if (!ids.length) return new Map();

    const targetColumn = targetType === 'SHOP' ? 'shop_id' : 'supplier_id';
    let { data, error } = await supabase.from('ratings')
      .select(`${targetColumn}, stars`)
      .eq('target_type', targetType)
      .eq('is_hidden', false)
      .in(targetColumn, ids);
    if (error?.code === '42703') {
      ({ data, error } = await supabase.from('ratings')
        .select(`${targetColumn}, stars`)
        .eq('target_type', targetType)
        .in(targetColumn, ids));
    }
    if (error?.code === '42P01') {
      return new Map(ids.map(id => [id, { rating_average: null, rating_count: 0 }]));
    }
    if (error) throw error;

    const totals = new Map();
    for (const rating of data || []) {
      const id = Number(rating[targetColumn]);
      const current = totals.get(id) || { sum: 0, count: 0 };
      current.sum += Number(rating.stars);
      current.count += 1;
      totals.set(id, current);
    }

    return new Map(ids.map(id => {
      const total = totals.get(id) || { sum: 0, count: 0 };
      return [id, {
        rating_average: total.count ? Number((total.sum / total.count).toFixed(1)) : null,
        rating_count: total.count,
      }];
    }));
  }

  static async getPublicReviews(targetType, targetId, limit = 20) {
    const targetColumn = targetType === 'SHOP' ? 'shop_id' : 'supplier_id';
    let { data: ratings, error } = await supabase.from('ratings')
      .select('id, reviewer_id, stars, comment, created_at, updated_at')
      .eq('target_type', targetType)
      .eq(targetColumn, targetId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error?.code === '42703') {
      ({ data: ratings, error } = await supabase.from('ratings')
        .select('id, reviewer_id, stars, comment, created_at, updated_at')
        .eq('target_type', targetType)
        .eq(targetColumn, targetId)
        .order('created_at', { ascending: false })
        .limit(limit));
    }
    if (error?.code === '42P01') return [];
    if (error) throw error;
    if (!ratings?.length) return [];

    const reviewerIds = [...new Set(ratings.map(r => r.reviewer_id))];
    const { data: users, error: userError } = await supabase.from('users')
      .select('id, first_name, last_name')
      .in('id', reviewerIds);
    if (userError) throw userError;
    const names = new Map((users || []).map(user => {
      const publicName = user.first_name
        ? `${user.first_name}${user.last_name ? ` ${user.last_name.charAt(0)}.` : ''}`
        : 'Verified user';
      return [user.id, publicName];
    }));

    return ratings.map(rating => ({
      ...rating,
      reviewer_name: names.get(rating.reviewer_id) || 'Verified user',
      verified_transaction: true,
    }));
  }

  static async getBusinessFeedback(targetType, targetId) {
    const targetColumn = targetType === 'SHOP' ? 'shop_id' : 'supplier_id';
    const transactionColumn = targetType === 'SHOP' ? 'reservation_id' : 'order_id';
    let { data: ratings, error } = await supabase.from('ratings')
      .select(`id, reviewer_id, stars, comment, created_at, updated_at, ${transactionColumn}`)
      .eq('target_type', targetType)
      .eq(targetColumn, targetId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false });
    if (error?.code === '42703') {
      ({ data: ratings, error } = await supabase.from('ratings')
        .select(`id, reviewer_id, stars, comment, created_at, updated_at, ${transactionColumn}`)
        .eq('target_type', targetType)
        .eq(targetColumn, targetId)
        .order('created_at', { ascending: false }));
    }
    if (error) throw error;

    const rows = ratings || [];
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(row => { distribution[row.stars] = (distribution[row.stars] || 0) + 1; });
    const average = rows.length
      ? Number((rows.reduce((sum, row) => sum + Number(row.stars), 0) / rows.length).toFixed(1))
      : null;
    if (!rows.length) return { rating_average: null, rating_count: 0, distribution, reviews: [] };

    const reviewerIds = [...new Set(rows.map(row => row.reviewer_id))];
    const transactionIds = [...new Set(rows.map(row => row[transactionColumn]))];
    const transactionTable = targetType === 'SHOP' ? 'reservations' : 'orders';
    const transactionNumber = targetType === 'SHOP' ? 'reservation_number' : 'order_number';
    const [{ data: users, error: userError }, { data: transactions, error: transactionError }] = await Promise.all([
      supabase.from('users').select('id, first_name, last_name').in('id', reviewerIds),
      supabase.from(transactionTable).select(`id, ${transactionNumber}`).in('id', transactionIds),
    ]);
    if (userError) throw userError;
    if (transactionError) throw transactionError;

    const names = new Map((users || []).map(user => [user.id,
      user.first_name
        ? `${user.first_name}${user.last_name ? ` ${user.last_name.charAt(0)}.` : ''}`
        : 'Verified user'
    ]));
    const numbers = new Map((transactions || []).map(row => [Number(row.id), row[transactionNumber]]));

    return {
      rating_average: average,
      rating_count: rows.length,
      distribution,
      reviews: rows.map(row => ({
        ...row,
        reviewer_name: names.get(row.reviewer_id) || 'Verified user',
        transaction_number: numbers.get(Number(row[transactionColumn])) || null,
        verified_transaction: true,
      })),
    };
  }

  static async listForModeration({ targetType, stars, visibility } = {}) {
    let query = supabase.from('ratings')
      .select('id, reviewer_id, target_type, shop_id, supplier_id, reservation_id, order_id, stars, comment, is_hidden, moderation_reason, moderated_at, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (targetType) query = query.eq('target_type', targetType);
    if (stars) query = query.eq('stars', stars);
    if (visibility === 'VISIBLE') query = query.eq('is_hidden', false);
    if (visibility === 'HIDDEN') query = query.eq('is_hidden', true);
    const { data: ratings, error } = await query;
    if (error?.code === '42703') {
      const migrationError = new Error('Rating moderation database update is required. Re-run scripts/ratings_migration.sql in Supabase SQL Editor.');
      migrationError.code = 'RATINGS_MIGRATION_REQUIRED';
      throw migrationError;
    }
    if (error) throw error;
    if (!ratings?.length) return [];

    const reviewerIds = [...new Set(ratings.map(row => row.reviewer_id))];
    const shopIds = [...new Set(ratings.map(row => row.shop_id).filter(Boolean))];
    const supplierIds = [...new Set(ratings.map(row => row.supplier_id).filter(Boolean))];
    const reservationIds = [...new Set(ratings.map(row => row.reservation_id).filter(Boolean))];
    const orderIds = [...new Set(ratings.map(row => row.order_id).filter(Boolean))];

    const safeIn = (table, columns, ids) => ids.length
      ? supabase.from(table).select(columns).in('id', ids)
      : Promise.resolve({ data: [], error: null });
    const [usersResult, shopsResult, suppliersResult, reservationsResult, ordersResult] = await Promise.all([
      safeIn('users', 'id, first_name, last_name, email', reviewerIds),
      safeIn('shops', 'id, shop_name', shopIds),
      safeIn('suppliers', 'id, company_name', supplierIds),
      safeIn('reservations', 'id, reservation_number', reservationIds),
      safeIn('orders', 'id, order_number', orderIds),
    ]);
    for (const result of [usersResult, shopsResult, suppliersResult, reservationsResult, ordersResult]) {
      if (result.error) throw result.error;
    }

    const users = new Map((usersResult.data || []).map(row => [row.id, row]));
    const shops = new Map((shopsResult.data || []).map(row => [row.id, row.shop_name]));
    const suppliers = new Map((suppliersResult.data || []).map(row => [row.id, row.company_name]));
    const reservations = new Map((reservationsResult.data || []).map(row => [row.id, row.reservation_number]));
    const orders = new Map((ordersResult.data || []).map(row => [row.id, row.order_number]));

    return ratings.map(row => {
      const reviewer = users.get(row.reviewer_id);
      return {
        ...row,
        reviewer_name: reviewer
          ? [reviewer.first_name, reviewer.last_name].filter(Boolean).join(' ')
          : 'Unknown user',
        reviewer_email: reviewer?.email || null,
        target_name: row.target_type === 'SHOP'
          ? shops.get(row.shop_id)
          : suppliers.get(row.supplier_id),
        transaction_number: row.target_type === 'SHOP'
          ? reservations.get(row.reservation_id)
          : orders.get(row.order_id),
      };
    });
  }

  static async setModeration(id, adminId, hidden, reason) {
    const update = hidden
      ? {
          is_hidden: true,
          moderated_by: adminId,
          moderation_reason: reason,
          moderated_at: new Date().toISOString(),
        }
      : {
          is_hidden: false,
          moderated_by: adminId,
          moderation_reason: reason || 'Restored by administrator',
          moderated_at: new Date().toISOString(),
        };
    const { data, error } = await supabase.from('ratings')
      .update(update).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data;
  }
}

module.exports = Rating;
