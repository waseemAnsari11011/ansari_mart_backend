const jwt = require('jsonwebtoken');
const Admin = require('./model');
const Order = require('../Order/model');
const User = require('../User/model');
const Product = require('../Product/model');

// @desc    Register admin (Initially for setup)
// @route   POST /api/admin/register
// @access  Public
exports.registerAdmin = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        const adminExists = await Admin.findOne({ email });

        if (adminExists) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        const admin = await Admin.create({
            name,
            email,
            password,
            phone
        });

        if (admin) {
            res.status(201).json({
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                token: generateToken(admin._id)
            });
        } else {
            res.status(400).json({ message: 'Invalid admin data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Auth admin & get token
// @route   POST /api/admin/login
// @access  Public
exports.loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;

        const admin = await Admin.findOne({ email });

        if (admin && (await admin.matchPassword(password))) {
            res.json({
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                token: generateToken(admin._id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private
exports.getAdminProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.user._id);

        if (admin) {
            res.json(admin);
        } else {
            res.status(404).json({ message: 'Admin not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Total Sales (sum of totalPrice from all non-cancelled orders)
        const salesData = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, totalSales: { $sum: '$totalPrice' } } }
        ]);
        const totalSales = salesData[0]?.totalSales || 0;

        // 2. Total Orders
        const totalOrders = await Order.countDocuments();

        // 3. User Counts
        const retailUsers = await User.countDocuments({ type: 'Retail' });
        const businessUsers = await User.countDocuments({ type: 'Business' });

        // 4. Critical Alerts
        const pendingVerifications = await User.countDocuments({ 
            type: 'Business', 
            'businessDetails.verificationStatus': 'Pending' 
        });

        const lowStockProducts = await Product.countDocuments({ stock: { $lte: 10 } });

        // 5. Recent Orders
        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('admin', 'name')
            .lean();

        res.json({
            stats: {
                totalSales,
                totalOrders,
                retailUsers,
                businessUsers
            },
            alerts: {
                pendingVerifications,
                lowStockProducts
            },
            recentOrders
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};
