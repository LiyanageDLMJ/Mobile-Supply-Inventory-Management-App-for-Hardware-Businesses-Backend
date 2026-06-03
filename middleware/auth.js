const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

// Block business actions until admin has verified the user.
// Customers and admins are always allowed through.
exports.requireVerified = (req, res, next) => {
  const role = req.user.role;
  if (role === 'CUSTOMER' || role === 'ADMIN') return next();

  const status = req.user.verification_status;
  if (status === 'VERIFIED') return next();

  return res.status(403).json({
    success: false,
    code: 'VERIFICATION_REQUIRED',
    verification_status: status || 'NOT_SUBMITTED',
    rejection_reason: req.user.rejection_reason || null,
    message:
      status === 'PENDING'
        ? 'Your account is awaiting admin verification. Business actions are disabled until then.'
        : status === 'REJECTED'
        ? 'Your verification was rejected. Please re-upload your documents from your profile.'
        : 'You must upload your business documents and be verified by the admin before using this feature.',
  });
};
