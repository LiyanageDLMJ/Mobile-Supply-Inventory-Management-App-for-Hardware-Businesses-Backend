const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and SHOP_OWNER role
router.use(protect);
router.use(authorize('SHOP_OWNER'));

router.get('/dashboard/stats', shopController.getDashboardStats);
router.get('/dashboard', shopController.getDashboard);
router.get('/profile', shopController.getProfile);
router.put('/profile', shopController.updateProfile);

module.exports = router;
