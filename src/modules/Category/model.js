const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String
    },
    image: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: true
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
