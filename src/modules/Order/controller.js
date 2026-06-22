const User = require("../User/model");
const sendOrderOtp = require("../../utils/orderOtp");
const Order = require('./model');
const Setting = require('../Setting/model');
const { isLocationServiceable } = require('../DeliveryZone/controller');

// @desc    Create new order
// @route   POST /api/orders
// @access  Public
exports.addOrderItems = async (req, res) => {
    try {
        const {
            orderItems,
            shippingAddress,
            paymentMethod,
            adminId,
            type
        } = req.body;

        const effectiveUserId = req.user?._id || adminId;

        // KYC Validation
        const user = await User.findById(effectiveUserId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (
            user.type === "Business" &&
            user.businessDetails?.verificationStatus !== "Approved"
        ) {
            return res.status(403).json({
                success: false,
                message: "Your KYC is pending approval. You cannot place orders until approved by admin."
            });
        }

        // Delivery Area Validation
        if (shippingAddress && shippingAddress.latitude && shippingAddress.longitude) {
            const isServiceable = await isLocationServiceable(shippingAddress.latitude, shippingAddress.longitude);
            if (!isServiceable) {
                return res.status(400).json({
                    message: 'Sorry, we do not deliver to this location yet.'
                });
            }
        }

        if (orderItems && orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        } else {
            // Clean numeric calculations to keep DB values as fixed integers without decimals
            const roundedOrderItems = orderItems.map(item => ({
                ...item,
                price: Math.round(item.price)
            }));

            // Calculate subtotal from items
            const subtotal = roundedOrderItems.reduce(
                (sum, item) => sum + (item.price * item.qty),
                0
            );

            let deliveryFee = 0;

            // Fetch logistics settings from DB
            const appSettings = await Setting.findOne();
            const logistics = appSettings?.logistics;
            const userType = req.user?.type || type || 'Retail';
            const rule = logistics?.[userType];

            if (rule?.mov != null && rule?.deliveryCharge != null) {
                if (subtotal < rule.mov) {
                    deliveryFee = rule.deliveryCharge;
                }
            }

            const finalTotalPrice = subtotal + deliveryFee;

            const order = new Order({
                orderItems: roundedOrderItems,
                admin: effectiveUserId,
                shippingAddress,
                paymentMethod,
                totalPrice: finalTotalPrice,
                deliveryFee,
                // Force order type to match the customer's actual account type if available
                type: req.user?.type ? req.user.type : (type || 'Retail')
            });

            const createdOrder = await order.save();
            await sendOrderOtp();
            console.log(`[ORDER] Created order ${createdOrder._id} for user ${adminId}`);
            res.status(201).json(createdOrder);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private/Admin
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('admin', 'name email');

        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            order.status = req.body.status || order.status;
            if (req.body.status === 'Delivered') {
                order.isDelivered = true;
                order.deliveredAt = Date.now();
            }

            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order item quantity
// @route   PUT /api/orders/:id/update-quantity
// @access  Private/Admin
exports.updateOrderItemQuantity = async (req, res) => {
    try {
        const { itemId, qty } = req.body;

        if (qty < 0) {
            return res.status(400).json({ message: 'Quantity cannot be less than 0' });
        }

        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        let itemFound = false;
        let newTotalPrice = 0;

        // Iterate, modify quantity and recalculate total
        for (let i = 0; i < order.orderItems.length; i++) {
            let currentId = order.orderItems[i]._id;
            if (currentId && currentId.toString() === itemId) {
                order.orderItems[i].qty = Number(qty);
                itemFound = true;
            }
            newTotalPrice += (order.orderItems[i].price * order.orderItems[i].qty);
        }

        if (!itemFound) {
            return res.status(404).json({ message: 'Item not found in order' });
        }

        let deliveryFee = 0;

        // Fetch logistics settings from DB
        const appSettings = await Setting.findOne();
        const logistics = appSettings?.logistics;
        const userType = order.type || 'Retail';
        const rule = logistics?.[userType];

        if (rule?.mov != null && rule?.deliveryCharge != null) {
            if (newTotalPrice < rule.mov) {
                deliveryFee = rule.deliveryCharge;
            }
        }

        order.deliveryFee = deliveryFee;
        order.totalPrice = Math.round(newTotalPrice + deliveryFee);

        // This is the most reliable way to save nested arrays in Mongoose
        order.markModified('orderItems');
        order.markModified('totalPrice');
        order.markModified('deliveryFee');

        await order.save();

        // Fetch completely fresh order to return
        const freshOrder = await Order.findById(req.params.id).populate('admin', 'name email');

        res.json(freshOrder);
    } catch (error) {
        console.error("Error in updateQuantity:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
exports.getMyOrders = async (req, res) => {
    try {
        console.log(`[ORDER] Fetching orders for user: ${req.user?._id}`);
        // Include essential orderItems fields for list view (image, name, qty, price)
        // but exclude heavy fields like full description
        const orders = await Order.find({ admin: req.user?._id })
            .select('orderItems.image orderItems.name orderItems.qty orderItems.price shippingAddress paymentMethod totalPrice status isDelivered createdAt')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`[ORDER] Found ${orders.length} orders for user ${req.user?._id}`);
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all orders for admin
// @route   GET /api/orders/all
// @access  Private/Admin
exports.getAdminOrders = async (req, res) => {
    try {
        // Exclude only the heavy base64 image field but keep the item details
        const orders = await Order.find({})
            .select('-orderItems.image')
            .sort({ createdAt: -1 })
            .populate('admin', 'name email')
            .lean();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
