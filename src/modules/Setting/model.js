const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    image: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
});

const settingSchema = new mongoose.Schema({
    banners: [bannerSchema],
    logistics: {
        baseDeliveryCharge: { type: Number, default: 40 },
        freeDeliveryThreshold: { type: Number, default: 500 },
        expressDeliverySurcharge: { type: Number, default: 80 }
    },
    units: { type: [String], default: ['Unit'] }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
