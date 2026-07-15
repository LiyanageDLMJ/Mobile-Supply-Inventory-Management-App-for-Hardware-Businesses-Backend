const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  listUsers,
  listAllUsers,
  getOverview,
  listPending,
  getUserDetail,
  getUserDocument,
  approveUser,
  rejectUser,
  getStats,
  listRatings,
  moderateRating,
} = require('../controllers/adminController');

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/overview', getOverview);
router.get('/stats', getStats);
router.get('/pending', listPending);
router.get('/all-users', listAllUsers);
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.get('/users/:id/documents/:index', getUserDocument);
router.post('/users/:id/approve', approveUser);
router.post('/users/:id/reject', rejectUser);
router.get('/ratings', listRatings);
router.patch('/ratings/:id/moderation', moderateRating);

module.exports = router;
