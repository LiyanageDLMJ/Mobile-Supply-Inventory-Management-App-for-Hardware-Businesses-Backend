const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getMyVerification,
  submitVerification,
  getMyDocument,
} = require('../controllers/verificationController');

router.use(protect);

router.get('/me', getMyVerification);
router.post('/submit', submitVerification);
router.get('/documents/:index', getMyDocument);

module.exports = router;
