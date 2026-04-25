const Order = require('./model');
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
            totalPrice,
            adminId,
            type
        } = req.body;

        const effectiveUserId = req.user?._id || adminId;

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
            const roundedTotalPrice = Math.round(totalPrice);
            const roundedOrderItems = orderItems.map(item => ({
                ...item,
                price: Math.round(item.price)
            }));

            const order = new Order({
                orderItems: roundedOrderItems,
                admin: effectiveUserId,
                shippingAddress,
                paymentMethod,
                totalPrice: roundedTotalPrice,
                // Force order type to match the customer's actual account type if available
                type: req.user?.type ? req.user.type : (type || 'Retail')
            });

            const createdOrder = await order.save();
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

        order.totalPrice = Math.round(newTotalPrice);
        
        // This is the most reliable way to save nested arrays in Mongoose
        order.markModified('orderItems');
        order.markModified('totalPrice');
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
