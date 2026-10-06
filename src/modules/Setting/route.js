const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.put('/discounts', require('../Middleware/authMiddleware').protect, controller.updateDiscounts);
router.get('/', controller.getSettings);
router.put('/banners', controller.updateBanners);
router.put('/logistics', controller.updateLogistics);
router.put('/units', controller.updateUnits);

module.exports = router;
