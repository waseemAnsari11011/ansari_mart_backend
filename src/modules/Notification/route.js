const router = require("express").Router();
const controller = require("./controller");
const { protect } = require("../Middleware/authMiddleware");
const createS3Upload = require("../Middleware/s3UploadMiddleware");

router.post(
    "/send-all",
    protect,
    ...createS3Upload("notifications"),
    controller.sendToAllUsers
);
router.post(
    "/resend/:id",
    protect,
    controller.resendNotification
);
router.get(
    "/history",
    protect,
    controller.getNotificationHistory
);
router.delete(
    "/:id",
    protect,
    controller.deleteNotification
);
module.exports = router;