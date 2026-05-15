const express = require('express');
const router = express.Router();
const controller = require('./controller');

router.get('/', controller.getHelpSupport);
router.post('/update', controller.updateHelpSupport);

module.exports = router;
