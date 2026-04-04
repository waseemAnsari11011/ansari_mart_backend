const express = require('express');
const router = express.Router();
const { addOrderItems, getOrderById, updateOrderStatus, getAdminOrders, getMyOrders } = require('./controller');
const { protect, protectAny } = require('../Middleware/authMiddleware');

router.route('/').post(protectAny, addOrderItems);
router.route('/all').get(protect, getAdminOrders);
router.route('/myorders').get(protectAny, getMyOrders);
router.route('/:id').get(protectAny, getOrderById);
router.route('/:id/status').put(protect, updateOrderStatus);

module.exports = router;
