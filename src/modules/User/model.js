const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");



const addressSchema = new mongoose.Schema({
  label: { type: String, required: true, default: "Home" },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  landmark: { type: String, default: "" },
  latitude: { type: Number },
  longitude: { type: Number },
  isDefault: { type: Boolean, default: false }
});

const businessDetailsSchema = new mongoose.Schema({
  shopName: { type: String, trim: true },
  businessType: { type: String, trim: true },
  gstNo: { type: String, trim: true },
  gstFile: { type: String, default: "" },
  panNo: { type: String, trim: true },
  panFile: { type: String, default: "" },
  businessAddress: { type: String, trim: true },
  latitude: { type: Number },
  longitude: { type: Number },
  verificationStatus: { 
    type: String, 
    enum: ["Pending", "Approved", "Rejected"], 
    default: "Pending" 
  }
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    phone: { type: String, required: true, unique: true, index: true },
    password: { type: String }, // Required for business, optional for retail if using OTP
    type: { type: String, enum: ["Retail", "Business"], required: true, default: "Retail" },
    status: { type: String, enum: ["Active", "Blocked", "Pending"], default: "Active" },
    address: { type: String, default: "" }, // Legacy single address field
    addresses: [addressSchema],
    profilePhoto: { type: String, default: "" },
    businessDetails: businessDetailsSchema,
    cart: [{
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true, default: 1 },
      tierIndex: { type: Number, default: 0 },
      isWholesale: { type: Boolean, default: false }
    }],
  },
  { timestamps: true }
);

// Password hashing before saving
userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
