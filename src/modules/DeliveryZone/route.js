const express = require('express');
const router = express.Router();
const { 
    createZone, 
    getZones, 
    updateZone, 
    deleteZone, 
    checkLocation 
} = require('./controller');
const { protect } = require('../Middleware/authMiddleware');

// Public routes
router.get('/', getZones);
router.post('/check', checkLocation);

// Admin only routes
router.post('/', protect, createZone);
router.put('/:id', protect, updateZone);
router.delete('/:id', protect, deleteZone);

module.exports = router;
