const supabase = require('../config/supabase');

class Notification {
  static async create({ userId, type, title, message }) {
    const { data, error } = await supabase.from('notifications').insert({
      user_id: userId, type, title, message,
    }).select().single();
    if (error) throw error;
    return data;
  }

  static async findByUserId(userId) {
    const { data, error } = await supabase.from('notifications')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data || [];
  }

  static async markRead(id, userId) {
    const { data, error } = await supabase.from('notifications')
      .update({ is_read: true }).eq('id', id).eq('user_id', userId).select().single();
    if (error) throw error;
    return data;
  }

  static async markAllRead(userId) {
    const { error } = await supabase.from('notifications')
      .update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    if (error) throw error;
  }

  static async getUnreadCount(userId) {
    const { count, error } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false);
    if (error) throw error;
    return count || 0;
  }
}

module.exports = Notification;
