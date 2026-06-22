const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    image: { type: String, required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
});

const settingSchema = new mongoose.Schema({
    banners: [bannerSchema],
    logistics: {
        Retail: {
            mov: { type: Number, default: 0, min: 0 },
            deliveryCharge: { type: Number, default: 0, min: 0 }
        },
        Business: {
            mov: { type: Number, default: 0, min: 0 },
            deliveryCharge: { type: Number, default: 0, min: 0 }
        }
    },
    units: { type: [String], default: ['Unit'] }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
