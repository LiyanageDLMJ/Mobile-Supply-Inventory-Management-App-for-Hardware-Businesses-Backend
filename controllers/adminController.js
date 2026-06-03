const User = require('../models/User');
const Notification = require('../models/Notification');
const supabase = require('../config/supabase');

// @desc    List shop owners + suppliers, optionally filtered by status
// @route   GET /api/admin/users?status=PENDING
// @access  Admin
exports.listUsers = async (req, res) => {
  try {
    const { status } = req.query;
    const allowed = ['NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of ${allowed.join(', ')}` });
    }
    const users = await User.listByVerificationStatus(status || null);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Admin list users error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    List ALL users (every role incl. customers), with optional role + search
// @route   GET /api/admin/all-users?role=CUSTOMER&search=john
// @access  Admin
exports.listAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;
    const allowedRoles = ['SHOP_OWNER', 'SUPPLIER', 'CUSTOMER', 'ADMIN'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `role must be one of ${allowedRoles.join(', ')}` });
    }
    const users = await User.listAll({ role: role || null, search: search || null });
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Admin list all users error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Platform-wide overview for the admin dashboard
// @route   GET /api/admin/overview
// @access  Admin
exports.getOverview = async (_req, res) => {
  try {
    const roleCount = async (role) => {
      const { count, error } = await supabase
        .from('users').select('*', { count: 'exact', head: true }).eq('role', role);
      if (error) throw error;
      return count || 0;
    };
    const tableCount = async (table, build) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (build) q = build(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    };

    const [
      shopOwners, suppliers, customers, admins,
      shops, supplierCompanies, products, orders, reservations, pendingVerifications,
    ] = await Promise.all([
      roleCount('SHOP_OWNER'),
      roleCount('SUPPLIER'),
      roleCount('CUSTOMER'),
      roleCount('ADMIN'),
      tableCount('shops'),
      tableCount('suppliers'),
      tableCount('products'),
      tableCount('orders'),
      tableCount('reservations'),
      tableCount('users', (q) => q.in('role', ['SHOP_OWNER', 'SUPPLIER']).eq('verification_status', 'PENDING')),
    ]);

    // Revenue = sum of delivered B2B orders (summed in JS — supabase-js has no SUM)
    const { data: delivered, error: revErr } = await supabase
      .from('orders').select('total_amount').eq('status', 'Delivered');
    if (revErr) throw revErr;
    const revenue = (delivered || []).reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

    const { data: recentSignups, error: recentErr } = await supabase
      .from('users')
      .select('id, first_name, last_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(8);
    if (recentErr) throw recentErr;

    res.json({
      success: true,
      data: {
        users: {
          total: shopOwners + suppliers + customers + admins,
          shopOwners, suppliers, customers, admins,
        },
        entities: { shops, supplierCompanies, products, orders, reservations },
        pendingVerifications,
        revenue,
        recentSignups: recentSignups || [],
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Pending verifications (convenience)
// @route   GET /api/admin/pending
// @access  Admin
exports.listPending = async (_req, res) => {
  try {
    const users = await User.listByVerificationStatus('PENDING');
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Admin list pending error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Full user detail (user row + shop/supplier + doc metadata)
// @route   GET /api/admin/users/:id
// @access  Admin
exports.getUserDetail = async (req, res) => {
  try {
    const id = req.params.id;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('id, first_name, last_name, username, email, phone, role, business_name, business_reg_number, nic_number, address, city, province, postal_code, verification_status, rejection_reason, submitted_at, verified_at, verified_by, verification_docs, created_at')
      .eq('id', id)
      .maybeSingle();
    if (userErr) throw userErr;
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    let shop = null;
    let supplier = null;
    if (user.role === 'SHOP_OWNER') {
      const { data } = await supabase.from('shops').select('*').eq('owner_id', id).maybeSingle();
      shop = data || null;
    } else if (user.role === 'SUPPLIER') {
      const { data } = await supabase.from('suppliers').select('*').eq('user_id', id).maybeSingle();
      supplier = data || null;
    }

    const docs = Array.isArray(user.verification_docs) ? user.verification_docs : [];
    const docsMeta = docs.map((d, i) => ({
      index: i,
      doc_type: d.doc_type,
      file_name: d.file_name,
      mime_type: d.mime_type,
      uploaded_at: d.uploaded_at,
    }));

    delete user.verification_docs;

    res.json({ success: true, data: { user, shop, supplier, documents: docsMeta } });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Stream (return) one of a user's documents (base64)
// @route   GET /api/admin/users/:id/documents/:index
// @access  Admin
exports.getUserDocument = async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ success: false, message: 'Invalid index' });

    const { data: user, error } = await supabase
      .from('users').select('verification_docs').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const docs = Array.isArray(user.verification_docs) ? user.verification_docs : [];
    if (idx >= docs.length) return res.status(404).json({ success: false, message: 'Document not found' });

    const d = docs[idx];
    res.json({
      success: true,
      data: {
        doc_type: d.doc_type,
        file_name: d.file_name,
        mime_type: d.mime_type,
        base64: d.base64,
        uploaded_at: d.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Admin get document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Approve a pending user
// @route   POST /api/admin/users/:id/approve
// @access  Admin
exports.approveUser = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role !== 'SHOP_OWNER' && target.role !== 'SUPPLIER') {
      return res.status(400).json({ success: false, message: 'Only shop owners and suppliers require verification.' });
    }

    const result = await User.approveVerification(target.id, req.user.id);

    Notification.create({
      userId: target.id,
      type: 'VERIFICATION_APPROVED',
      title: 'Account verified ✅',
      message: 'Your business documents were approved. You can now use all features.',
    }).catch((err) => console.error('Notify user (approve) failed:', err.message));

    res.json({ success: true, message: 'User approved.', data: result });
  } catch (error) {
    console.error('Admin approve error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Reject a pending user with a reason
// @route   POST /api/admin/users/:id/reject
// @access  Admin
exports.rejectUser = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'A rejection reason (min 3 chars) is required.' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target.role !== 'SHOP_OWNER' && target.role !== 'SUPPLIER') {
      return res.status(400).json({ success: false, message: 'Only shop owners and suppliers require verification.' });
    }

    const result = await User.rejectVerification(target.id, req.user.id, reason.trim());

    Notification.create({
      userId: target.id,
      type: 'VERIFICATION_REJECTED',
      title: 'Verification rejected',
      message: `Your documents were rejected: ${reason.trim()}. Please re-upload from your profile.`,
    }).catch((err) => console.error('Notify user (reject) failed:', err.message));

    res.json({ success: true, message: 'User rejected.', data: result });
  } catch (error) {
    console.error('Admin reject error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Quick counts for admin dashboard tiles
// @route   GET /api/admin/stats
// @access  Admin
exports.getStats = async (_req, res) => {
  try {
    const statuses = ['PENDING', 'VERIFIED', 'REJECTED', 'NOT_SUBMITTED'];
    const counts = {};
    await Promise.all(
      statuses.map(async (s) => {
        const { count, error } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .in('role', ['SHOP_OWNER', 'SUPPLIER'])
          .eq('verification_status', s);
        if (error) throw error;
        counts[s] = count || 0;
      })
    );
    res.json({ success: true, data: counts });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
