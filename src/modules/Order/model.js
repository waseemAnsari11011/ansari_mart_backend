const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    orderItems: [
        {
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            image: { type: String, required: true },
            price: { type: Number, required: true },
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true
            }
        }
    ],
    shippingAddress: {
        name: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true },
        state: { type: String, required: true },
        phone: { type: String, required: true }
    },
    paymentMethod: {
        type: String,
        required: true,
        default: 'Cash'
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    status: {
        type: String,
        required: true,
        enum: ['Pending', 'Packing', 'On the way', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false
    },
    paidAt: {
        type: Date
    },
    isDelivered: {
        type: Boolean,
        required: true,
        default: false
    },
    deliveredAt: {
        type: Date
    },
    type: {
        type: String,
        enum: ['Retail', 'Business'],
        required: true,
        default: 'Retail'
    }
}, {
    timestamps: true
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
