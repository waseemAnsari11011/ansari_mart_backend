const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const controller = require("./controller");
const { protectAny } = require("../Middleware/authMiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "src/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Using protectAny to allow both admin (panel) and user (mobile app) to upload
router.post("/", protectAny, upload.single("image"), controller.uploadImage);

module.exports = router;
