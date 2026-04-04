const User = require("./model");
const Order = require("../Order/model");
const jwt = require("jsonwebtoken");
const sendOtpCode = require("../../utils/sendOtp");

// In-memory store for OTPs (Development only)
const otpStore = {};

const generateToken = (id, type) => {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// --- Customer (Retail) OTP Auth Mock ---

// Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required." });
    
    // Generate a random 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store this OTP temporarily
    otpStore[phone] = otp;

    // Send the OTP via SMS (Renflair)
    const result = await sendOtpCode(phone, otp);
    
    if (result.success) {
        res.status(200).json({ message: "OTP sent successfully to your phone number." });
    } else {
        // Map common errors to user-friendly messages
        let userMessage = "Failed to send OTP. Please try again.";
        
        if (result.message === 'I' || result.message?.toLowerCase().includes('invalid')) {
            userMessage = "Invalid phone number. Please check and try again.";
        } else if (result.message === 'FAILED' || result.rawStatus === 'FAILED') {
            userMessage = "SMS service is currently unavailable. Please try later.";
        }
        
        res.status(500).json({ 
            message: userMessage,
            error: result.message // For debugging logs if needed
        });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Verify OTP & Login/Register User (Retail or Business)
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, type } = req.body; // type: 'Retail' or 'Business'
    
    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required." });
    }

    const userType = type || "Retail";

    const mongoose = require('mongoose');
    console.log(`[AUTH] Verifying OTP for ${phone} as ${userType}`);
    console.log('[AUTH] Current DB:', mongoose.connection.name);

    if (otp !== "1234" && otp !== otpStore[phone]) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Clear OTP after successful verification
    delete otpStore[phone];

    // Find User by phone first to avoid duplicate key error
    let user = await User.findOne({ phone });
    
    if (user) {
        // If user exists but with different type, inform them
        if (user.type !== userType) {
            return res.status(400).json({ 
                message: `This phone number is already registered as a ${user.type} user. Please log in as ${user.type} or use a different number.` 
            });
        }
        console.log(`[AUTH] Existing ${userType} user found:`, user._id);
    } else {
        console.log(`[AUTH] Creating new ${userType} user for phone:`, phone);
        user = await User.create({
            phone: phone,
            type: userType,
            status: userType === "Business" ? "Pending" : "Active"
        });
    }
    
    console.log('[AUTH] Found/Created User ID:', user._id);

    if (user.status === "Blocked") {
      return res.status(403).json({ message: "This account has been blocked. Please contact support." });
    }

    const token = generateToken(user._id, user.type);

    // Check if name is filled (for both Retail and Business)
    const isNewUser = !user.name;

    res.status(200).json({
      message: "Login successful",
      user: {
        _id: user._id,
        phone: user.phone,
        type: user.type,
        status: user.status,
        name: user.name,
        businessDetails: user.businessDetails
      },
      isNewUser,
      token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- Protected Routes ---

// Get User Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
// --- Admin Specific Routes ---

// Get All Users (with filter)
exports.getAllUsers = async (req, res) => {
  try {
    const { type } = req.query; // 'Retail' or 'Business'
    const query = {};
    if (type) query.type = type;
    
    console.log(`[ADMIN] Fetching users with query:`, query);
    const users = await User.find(query).sort({ createdAt: -1 });
    console.log(`[ADMIN] Found ${users.length} users`);
    
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update User Status (Block/Unblock)
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!["Active", "Blocked", "Pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const update = { status };
    if (status === "Active") {
      update["businessDetails.verificationStatus"] = "Approved";
    } else if (status === "Pending") {
      update["businessDetails.verificationStatus"] = "Pending";
    }

    const user = await User.findByIdAndUpdate(id, update, { new: true });
    if (!user) return res.status(404).json({ message: "User not found" });
    
    res.status(200).json({ message: `User status updated to ${status}`, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get User by ID with Stats and Recent Orders
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-otp -otpExpires");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get Order Stats
    const orders = await Order.find({ admin: id });
    const ordersCount = orders.length;
    
    const totalSpent = orders
      .filter(o => o.status === 'Delivered')
      .reduce((acc, curr) => acc + curr.totalPrice, 0);

    // Get Recent Orders
    const recentOrders = await Order.find({ admin: id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      user,
      stats: {
        ordersCount,
        totalSpent: totalSpent.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
      },
      recentOrders
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Profile (Name, Address, Business Details)
exports.updateProfile = async (req, res) => {
  try {
    const { name, address, businessDetails } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (req.body.profilePhoto !== undefined) updateData.profilePhoto = req.body.profilePhoto;
    if (businessDetails !== undefined) {
      updateData.businessDetails = {
        ...req.user.businessDetails, // Keep existing details
        ...businessDetails
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- Address Management ---

// Add a new address
exports.addAddress = async (req, res) => {
  try {
    const { label, name, phone, address, city, state, pincode, latitude, longitude, isDefault } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const newAddress = { label, name, phone, address, city, state, pincode, latitude, longitude, isDefault };
    
    // If this is the first address or set as default, handle it
    if (isDefault || user.addresses.length === 0) {
      user.addresses.forEach(addr => addr.isDefault = false);
      newAddress.isDefault = true;
    }

    user.addresses.push(newAddress);
    await user.save();

    res.status(201).json({ message: "Address added successfully", addresses: user.addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update an existing address
exports.updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) return res.status(404).json({ message: "Address not found" });

    // Handle default logic if isDefault changed to true
    if (updateData.isDefault) {
      user.addresses.forEach(addr => addr.isDefault = false);
    }

    // Update specific fields
    Object.keys(updateData).forEach(key => {
      user.addresses[addressIndex][key] = updateData[key];
    });

    await user.save();
    res.status(200).json({ message: "Address updated successfully", addresses: user.addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete an address
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addressToDelete = user.addresses.find(addr => addr._id.toString() === addressId);
    if (!addressToDelete) return res.status(404).json({ message: "Address not found" });

    user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);

    // If we deleted the default address, make the first one default if it exists
    if (addressToDelete.isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();
    res.status(200).json({ message: "Address deleted successfully", addresses: user.addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Set an address as default
exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const addressExists = user.addresses.some(addr => addr._id.toString() === addressId);
    if (!addressExists) return res.status(404).json({ message: "Address not found" });

    user.addresses.forEach(addr => {
      addr.isDefault = addr._id.toString() === addressId;
    });

    await user.save();
    res.status(200).json({ message: "Default address updated", addresses: user.addresses });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// --- Cart Management ---

// Get User Cart
exports.getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('cart.product');
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user.cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add Item to Cart
exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity, isWholesale, tierIndex } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Identify existing item by BOTH productId and tierIndex
    const tIdx = tierIndex || 0;
    const existingItemIndex = user.cart.findIndex(item => 
      item.product.toString() === productId && 
      (item.tierIndex || 0) === tIdx
    );
    
    if (existingItemIndex > -1) {
      user.cart[existingItemIndex].quantity += quantity;
    } else {
      user.cart.push({ product: productId, quantity, isWholesale, tierIndex: tIdx });
    }

    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('cart.product');
    res.status(200).json(updatedUser.cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add Multiple Items to Cart (Bulk)
exports.addBulkToCart = async (req, res) => {
  try {
    const { items } = req.body; // Array of { productId, quantity, isWholesale, tierIndex }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Items array is required" });
    }

    items.forEach(newItem => {
        const tIdx = newItem.tierIndex || 0;
        const existingItemIndex = user.cart.findIndex(item => 
          item.product.toString() === newItem.productId && 
          (item.tierIndex || 0) === tIdx
        );

        if (existingItemIndex > -1) {
            user.cart[existingItemIndex].quantity += newItem.quantity;
        } else {
            user.cart.push({ 
                product: newItem.productId, 
                quantity: newItem.quantity, 
                isWholesale: newItem.isWholesale, 
                tierIndex: tIdx 
            });
        }
    });

    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('cart.product');
    res.status(200).json(updatedUser.cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update Cart Item Quantity
exports.updateCartQty = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, tierIndex } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: "User not found" });

    const tIdx = tierIndex || 0;
    if (quantity <= 0) {
      user.cart = user.cart.filter(item => 
        !(item.product.toString() === productId && (item.tierIndex || 0) === tIdx)
      );
    } else {
      const item = user.cart.find(item => 
        item.product.toString() === productId && (item.tierIndex || 0) === tIdx
      );
      if (item) item.quantity = quantity;
    }

    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('cart.product');
    res.status(200).json(updatedUser.cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Remove Item from Cart
exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    const { tierIndex } = req.query; 
    const user = await User.findById(req.user._id);
    
    if (!user) return res.status(404).json({ message: "User not found" });

    const tIdx = parseInt(tierIndex) || 0;
    user.cart = user.cart.filter(item => 
      !(item.product.toString() === productId && (item.tierIndex || 0) === tIdx)
    );
    
    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('cart.product');
    res.status(200).json(updatedUser.cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Clear Entire Cart
exports.clearCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = [];
    
    await user.save();
    res.status(200).json(user.cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
