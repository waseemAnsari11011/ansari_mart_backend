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
    price: {
        type: Number,
        required: true,
        default: 0
    },
    brand: {
        type: String,
        trim: true
    },
    unit: {
        type: String,
        default: 'Piece'
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
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
        price: { type: Number, required: true },
        unit: { type: String, default: 'Piece' },
        stock: { type: Number, required: true, default: 0 }
    }],
    businessPricing: [{
        label: { type: String, default: "" },
        minQty: { type: Number },
        maxQty: { type: Number },
        price: { type: Number, required: true },
        unit: { type: String, default: 'Piece' },
        stock: { type: Number, required: true, default: 0 }
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
    stock: {
        type: Number,
        required: true,
        default: 0
    },
    images: {
        type: [String],
        default: []
    },
    hsnCode: {
        type: String,
        trim: true
    },
    minOrderQty: {
        type: Number,
        default: 1
    },
    leadTime: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
