const express = require("express");
const router = express.Router();
const controller = require("./controller");
const { protectUser, protect } = require("../Middleware/authMiddleware");

// Customer Authentication
router.post("/send-otp", controller.sendOtp);
router.post("/verify-otp", controller.verifyOtp);

// Business Authentication

// Protected routes (for Mobile App users)
router.get("/profile", protectUser, controller.getProfile);
router.patch("/update-profile", protectUser, controller.updateProfile);

// Cart Management (Protected)
router.get("/cart", protectUser, controller.getCart);
router.post("/cart", protectUser, controller.addToCart);
router.post("/cart/bulk", protectUser, controller.addBulkToCart);
router.put("/cart/:productId", protectUser, controller.updateCartQty);
router.delete("/cart/:productId", protectUser, controller.removeFromCart);
router.delete("/cart", protectUser, controller.clearCart);

// Admin Routes (for Panel)
router.get("/", protect, controller.getAllUsers);
router.get("/:id", protect, controller.getUserById);
router.patch("/:id/status", protect, controller.updateUserStatus);

// Address Management (Protected)
router.post("/addresses", protectUser, controller.addAddress);
router.patch("/addresses/:addressId", protectUser, controller.updateAddress);
router.delete("/addresses/:addressId", protectUser, controller.deleteAddress);
router.patch("/addresses/:addressId/default", protectUser, controller.setDefaultAddress);

module.exports = router;
