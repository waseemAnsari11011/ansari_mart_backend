const express = require('express');
const router = express.Router();
const { registerAdmin, loginAdmin, getAdminProfile, getDashboardStats } = require('./controller');
const { protect } = require('../Middleware/authMiddleware');
const { getOrderTrends } = require('./trendController');

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.get('/profile', protect, getAdminProfile);
router.get('/dashboard', protect, getDashboardStats);
router.get('/order-trends', protect, getOrderTrends);

module.exports = router;
