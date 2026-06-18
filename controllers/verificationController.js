const User = require('../models/User');
const Notification = require('../models/Notification');

// Max raw bytes per uploaded document (after base64 decode)
const MAX_DOC_BYTES = 3 * 1024 * 1024; // 3 MB
const MAX_DOCS = 5;
const ALLOWED_DOC_TYPES = [
  'BUSINESS_REGISTRATION',
  'NIC_FRONT',
  'NIC_BACK',
  'TRADE_LICENSE',
  'TAX_CERTIFICATE',
  'OTHER',
];

function base64Bytes(b64) {
  if (!b64) return 0;
  const padding = (b64.match(/=+$/) || [''])[0].length;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// @desc    Get my verification state
// @route   GET /api/verification/me
// @access  Private
exports.getMyVerification = async (req, res) => {
  try {
    const state = await User.getVerificationState(req.user.id);
    if (!state) return res.status(404).json({ success: false, message: 'User not found' });

    // Don't echo raw base64 back to client — just metadata
    const docsMeta = Array.isArray(state.verification_docs)
      ? state.verification_docs.map((d) => ({
          doc_type: d.doc_type,
          file_name: d.file_name,
          mime_type: d.mime_type,
          uploaded_at: d.uploaded_at,
          size_kb: d.base64 ? Math.round(base64Bytes(d.base64) / 1024) : null,
        }))
      : [];

    res.json({
      success: true,
      data: {
        verification_status: state.verification_status,
        rejection_reason: state.rejection_reason,
        submitted_at: state.submitted_at,
        verified_at: state.verified_at,
        documents: docsMeta,
      },
    });
  } catch (error) {
    console.error('Get verification state error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Submit / re-submit verification documents
// @route   POST /api/verification/submit
// @access  Private (SHOP_OWNER, SUPPLIER)
exports.submitVerification = async (req, res) => {
  try {
    if (req.user.role !== 'SHOP_OWNER' && req.user.role !== 'SUPPLIER') {
      return res.status(403).json({
        success: false,
        message: 'Only shop owners and suppliers need to submit verification.',
      });
    }

    if (req.user.verification_status === 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'Your previous submission is still under review. Please wait for the admin to respond.',
      });
    }

    const { documents } = req.body;
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one document is required.' });
    }
    if (documents.length > MAX_DOCS) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_DOCS} documents allowed.` });
    }

    const required = ['BUSINESS_REGISTRATION'];
    const providedTypes = documents.map((d) => d.doc_type);
    for (const r of required) {
      if (!providedTypes.includes(r)) {
        return res.status(400).json({
          success: false,
          message: `Required document missing: ${r}`,
        });
      }
    }

    const cleaned = [];
    for (const d of documents) {
      if (!d || !d.doc_type || !d.base64) {
        return res.status(400).json({ success: false, message: 'Each document needs doc_type and base64.' });
      }
      if (!ALLOWED_DOC_TYPES.includes(d.doc_type)) {
        return res.status(400).json({ success: false, message: `Unknown doc_type: ${d.doc_type}` });
      }
      const size = base64Bytes(d.base64);
      if (size > MAX_DOC_BYTES) {
        return res.status(400).json({
          success: false,
          message: `Document "${d.doc_type}" is too large (${Math.round(size / 1024)} KB). Max ${MAX_DOC_BYTES / 1024 / 1024} MB.`,
        });
      }
      cleaned.push({
        doc_type: d.doc_type,
        file_name: d.file_name || `${d.doc_type}.jpg`,
        mime_type: d.mime_type || 'image/jpeg',
        base64: d.base64,
        uploaded_at: new Date().toISOString(),
      });
    }

    const result = await User.submitVerification(req.user.id, cleaned);

    // Notify the admin (best-effort, non-blocking)
    User.findAdminId()
      .then((adminId) => {
        if (!adminId) return;
        return Notification.create({
          userId: adminId,
          type: 'VERIFICATION_SUBMITTED',
          title: 'New verification request',
          message: `${req.user.first_name || req.user.username} (${req.user.role}) submitted documents for review.`,
        });
      })
      .catch((err) => console.error('Notify admin failed:', err.message));

    res.status(200).json({
      success: true,
      message: 'Documents submitted. The admin will review them shortly.',
      data: result,
    });
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

// @desc    Stream (return) a single document (base64) for the logged-in user
// @route   GET /api/verification/documents/:index
// @access  Private (owner only)
exports.getMyDocument = async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0) return res.status(400).json({ success: false, message: 'Invalid index' });

    const state = await User.getVerificationState(req.user.id);
    const docs = Array.isArray(state?.verification_docs) ? state.verification_docs : [];
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
    console.error('Get document error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

module.exports = exports;
