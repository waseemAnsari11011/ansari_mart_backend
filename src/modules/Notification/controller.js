const admin = require("../../services/firebase");
const User = require("../User/model");
const Notification = require("./model");
const {
    extractS3KeyFromUrl,
    deleteS3Objects,
} = require("../Middleware/s3DeleteUtil");

exports.sendToAllUsers = async (req, res) => {
    try {
        const { title, body, productId } = req.body;

        console.log("REQ FILES =>", req.files);
        console.log("REQ BODY =>", req.body);

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: "Title and body are required",
            });
        }

        // 1. IMAGE URL (S3/Multer se aayega)
        let imageUrl = null;

        const file =
            (req.files && req.files.length > 0 && req.files[0]) ||
            req.file;

        if (file) {
            imageUrl = file.location || null;
        }

        // 2. GET USERS TOKENS
        const users = await User.find({
            fcmToken: { $exists: true, $ne: null },
        });

        let tokens = users.map((u) => u.fcmToken);
        tokens = [...new Set(tokens)];

        if (tokens.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No users found",
            });
        }

        // 3. FIREBASE MESSAGE
        const message = {
            tokens,
            notification: {
                title,
                body,
                image: imageUrl, // 🔥 IMPORTANT
            },
            data: {
                title: String(title || ""),
                body: String(body || ""),
                productId: String(productId || ""),
                imageUrl: String(imageUrl || ""),
            },
        };

        const response = await admin
            .messaging()
            .sendEachForMulticast(message);

        // 4. SAVE IN MONGODB (MODEL USE)
        const notification = await Notification.create({
            title,
            body,
            imageUrl,
            recipientCount: tokens.length,
            productId: productId || null,
        });

        return res.json({
            success: true,
            sent: response.successCount,
            failed: response.failureCount,
            notification,
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.getNotificationHistory = async (req, res) => {
    try {
        const notifications = await Notification.find()
            .populate("productId", "name")
            .sort({ createdAt: -1 });

        return res.json({
            success: true,
            notifications,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(
            req.params.id
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        // Delete image from S3
        if (notification.imageUrl) {
            const key = extractS3KeyFromUrl(
                notification.imageUrl
            );

            if (key) {
                await deleteS3Objects([key]);
            }
        }

        // Delete DB record
        await Notification.findByIdAndDelete(
            req.params.id
        );

        return res.json({
            success: true,
            message: "Notification deleted successfully",
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
exports.resendNotification = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        const users = await User.find({
            fcmToken: { $exists: true, $ne: null },
        });

        let tokens = users.map((u) => u.fcmToken);
        tokens = [...new Set(tokens)];

        if (tokens.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No users found",
            });
        }

        const message = {
            tokens,
            notification: {
                title: notification.title,
                body: notification.body,
                image: notification.imageUrl || "",
            },
            data: {
                title: String(notification.title || ""),
                body: String(notification.body || ""),
                productId: String(notification.productId || ""),
                imageUrl: String(notification.imageUrl || ""),
            },
        };

        const response = await admin
            .messaging()
            .sendEachForMulticast(message);

        return res.json({
            success: true,
            sent: response.successCount,
            failed: response.failureCount,
            message: "Notification resent successfully",
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};