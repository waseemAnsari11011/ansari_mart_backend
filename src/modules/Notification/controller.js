const admin = require("../../services/firebase");
const User = require("../User/model");

exports.sendToAllUsers = async (req, res) => {

    try {

        console.log("REQ BODY =>", req.body);

        const { title, body, productId } = req.body;

        console.log("TITLE =>", title);
        console.log("BODY =>", body);
        console.log("PRODUCT ID =>", productId);


        const users = await User.find({
            fcmToken: { $exists: true, $ne: null }
        });

        const tokens = users.map(u => u.fcmToken);

        const message = {
            tokens,
            notification: {
                title,
                body
            },
            data: {
                title: String(title || ""),
                body: String(body || ""),
                productId: String(productId || "")
            }
        };

        const response = await admin
            .messaging()
            .sendEachForMulticast(message);

        return res.json({
            success: true,
            sent: response.successCount,
            failed: response.failureCount
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};