const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        trim: true
    },
    retailStatus: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    businessStatus: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    retailPricing: [{
        label: { type: String, default: "" },
        minQty: { type: Number },
        maxQty: { type: Number },
        price: { type: Number, required: true, validate: value => Number.isFinite(value) && value > 0 },
        unit: { type: String, required: true, trim: true },
        stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
    }],
    businessPricing: [{
        label: { type: String, default: "" },
        minQty: { type: Number },
        maxQty: { type: Number },
        price: { type: Number, required: true, validate: value => Number.isFinite(value) && value > 0 },
        unit: { type: String, required: true, trim: true },
        stock: { type: Number, required: true, min: 0, validate: Number.isSafeInteger }
    }],
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    images: {
        type: [String],
        default: []
    },
    mrp: {
        type: Number,
        default: 0
    },
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
