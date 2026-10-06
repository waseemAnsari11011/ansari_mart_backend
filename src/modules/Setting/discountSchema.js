const mongoose = require('mongoose');
module.exports = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    active: { type: Boolean, default: false },
    customerType: { type: String, enum: ['All', 'Retail', 'Business'], default: 'All' },
    firstOrderOnly: { type: Boolean, default: false },
    productOfferMode: { type: String, enum: ['single_unit', 'all_units'] },
    threshold: { type: Number, min: 0 },
    productPrices: [{ product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, tierIndex: { type: Number, min: 0, required: true }, offerPrice: { type: Number, min: 0, required: true }, _id: false }],
    minSubtotal: { type: Number, min: 0, default: 0 },
    maxSubtotal: { type: Number, min: 0, default: null },
    discountType: { type: String, enum: ['fixed', 'percentage', 'product_price'], default: 'fixed' },
    value: { type: Number, min: 0, required: true }
}, { _id: false });
