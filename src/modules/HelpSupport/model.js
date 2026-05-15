const mongoose = require('mongoose');

const helpSupportSchema = new mongoose.Schema({
    mobile: { type: String, required: true, default: '' },
    email: { type: String, required: true, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('HelpSupport', helpSupportSchema);
