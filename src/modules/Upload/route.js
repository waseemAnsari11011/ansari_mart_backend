const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { protectAny } = require("../Middleware/authMiddleware");
const handleS3Upload = require("../Middleware/s3UploadHandler");

// Using S3 upload instead of local disk storage
// 'uploads' is the folder name in S3, 'single' tells it to use upload.single('image')
router.post("/", protectAny, handleS3Upload("uploads", "single"), controller.uploadImage);

module.exports = router;
