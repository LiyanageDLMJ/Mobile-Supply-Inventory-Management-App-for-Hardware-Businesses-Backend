const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, updateProfile, changePassword, requestPasswordReset, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name must contain only letters'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name must contain only letters'),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^0[0-9]{9}$/)
    .withMessage('Phone must be 10 digits starting with 0 (e.g., 0701234567)'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
  body('accountType')
    .isIn(['SHOP_OWNER', 'SUPPLIER', 'CUSTOMER', 'ADMIN'])
    .withMessage('Invalid account type'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name must contain only letters'),
  body('lastName')
    .optional()
    .trim()
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name must contain only letters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email'),
  body('phoneNumber')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^0[0-9]{9}$/)
    .withMessage('Phone must be 10 digits starting with 0 (e.g., 0701234567)'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfileValidation, updateProfile);
router.put('/change-password', protect, changePasswordValidation, changePassword);
router.post('/forgot-password', body('email').isEmail(), requestPasswordReset);
router.post('/reset-password',
  body('email').isEmail(),
  body('resetToken').trim().notEmpty(),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  resetPassword
);

module.exports = router;
