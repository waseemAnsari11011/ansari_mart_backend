const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },

        body: {
            type: String,
            required: true,
            trim: true,
        },

        imageUrl: {
            type: String,
            default: null,
        },

        recipientCount: {
            type: Number,
            default: 0,
        },

        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;