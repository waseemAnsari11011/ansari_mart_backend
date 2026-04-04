const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.get('/', controller.getSettings);
router.put('/banners', controller.updateBanners);
router.put('/logistics', controller.updateLogistics);
router.put('/units', controller.updateUnits);

module.exports = router;
