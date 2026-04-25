const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'Primary Delivery Area'
    },
    area: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]], // Array of arrays of arrays [lng, lat]
            required: true
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Add 2dsphere index for geospatial queries
deliveryZoneSchema.index({ area: '2dsphere' });

module.exports = mongoose.model('DeliveryZone', deliveryZoneSchema);
