const User = require("../User/model");
const mongoose = require('mongoose');
const sendOrderOtp = require("../../utils/orderOtp");
const Order = require('./model');
const Product = require('../Product/model');
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

        const user = await User.findById(effectiveUserId);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
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

        if (!Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ message: 'No order items' });
        } else {
            const userType = req.user?.type || type || 'Retail';
            const pricingField = userType === 'Business' ? 'businessPricing' : 'retailPricing';
            let createdOrder;

            // A transaction prevents two simultaneous checkouts from selling the same stock.
            await mongoose.connection.transaction(async session => {
                const validatedItems = [];

                for (const item of orderItems) {
                    const qty = Number(item.qty);
                    const tierIndex = Number(item.tierIndex || 0);
                    if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(tierIndex) || tierIndex < 0) {
                        const error = new Error('Order quantities and product options must be valid whole numbers');
                        error.statusCode = 400;
                        throw error;
                    }

                    const product = await Product.findById(item.product).session(session);
                    if (!product) {
                        const error = new Error('A product in your cart is no longer available');
                        error.statusCode = 400;
                        throw error;
                    }

                    const tier = product[pricingField]?.[tierIndex];
                    if (!tier) {
                        const error = new Error(`${product.name}: selected option is no longer available`);
                        error.statusCode = 400;
                        throw error;
                    }
                    if (qty > tier.stock) {
                        const error = new Error(`Only ${tier.stock} item${tier.stock === 1 ? '' : 's'} of ${product.name} are available`);
                        error.statusCode = 400;
                        throw error;
                    }

                    tier.stock -= qty;
                    await product.save({ session });
                    validatedItems.push({
                        product: product._id,
                        name: product.name,
                        qty,
                        image: product.images?.[0] || item.image || '',
                        price: Math.round(tier.price),
                        unit: tier.unit || '',
                        weight: product.weight || product.brand || '',
                        tierLabel: tier.label || '',
                        tierIndex
                    });
                }

                const subtotal = validatedItems.reduce(
                    (sum, item) => sum + (item.price * item.qty),
                    0
                );
                let deliveryFee = 0;
                const appSettings = await Setting.findOne().session(session);
                const rule = appSettings?.logistics?.[userType];
                if (rule?.mov != null && rule?.deliveryCharge != null && subtotal < rule.mov) {
                    deliveryFee = rule.deliveryCharge;
                }

                const orders = await Order.create([{
                    orderItems: validatedItems,
                    admin: effectiveUserId,
                    shippingAddress,
                    paymentMethod,
                    totalPrice: subtotal + deliveryFee,
                    deliveryFee,
                    type: userType
                }], { session });
                createdOrder = orders[0];
            });

            try {
                await sendOrderOtp();
            } catch (notificationError) {
                // The order is already committed; notification failure must not make
                // the client retry and create a duplicate order.
                console.error('[ORDER] OTP notification failed:', notificationError);
            }
            console.log(`[ORDER] Created order ${createdOrder._id} for user ${adminId}`);
            res.status(201).json(createdOrder);
        }
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message });
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private/Admin
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('admin', 'name email')
            .populate('orderItems.product', 'name brand weight');

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
            if (order.status === 'Cancelled' && req.body.status && req.body.status !== 'Cancelled') {
                return res.status(400).json({ message: 'A cancelled order cannot be reopened because its stock has been released' });
            }

            if (req.body.status === 'Cancelled' && order.status !== 'Cancelled') {
                const pricingField = order.type === 'Business' ? 'businessPricing' : 'retailPricing';
                await mongoose.connection.transaction(async session => {
                    const transactionalOrder = await Order.findById(req.params.id).session(session);
                    if (!transactionalOrder || transactionalOrder.status === 'Cancelled') return;

                    for (const item of transactionalOrder.orderItems) {
                        const stockPath = `${pricingField}.${item.tierIndex || 0}.stock`;
                        await Product.updateOne(
                            { _id: item.product },
                            { $inc: { [stockPath]: item.qty } },
                            { session }
                        );
                    }
                    transactionalOrder.status = 'Cancelled';
                    await transactionalOrder.save({ session });
                });
                return res.json(await Order.findById(req.params.id));
            }

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
        const requestedQty = Number(qty);

        if (!Number.isInteger(requestedQty) || requestedQty < 0) {
            return res.status(400).json({ message: 'Quantity must be a non-negative whole number' });
        }

        let order;
        await mongoose.connection.transaction(async session => {
            order = await Order.findById(req.params.id).session(session);

            if (!order) {
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }
            if (order.status === 'Cancelled') {
                const error = new Error('Cancelled orders cannot be edited');
                error.statusCode = 400;
                throw error;
            }

            const item = order.orderItems.id(itemId);
            if (!item) {
                const error = new Error('Item not found in order');
                error.statusCode = 404;
                throw error;
            }

            const difference = requestedQty - item.qty;
            const pricingField = order.type === 'Business' ? 'businessPricing' : 'retailPricing';
            const stockPath = `${pricingField}.${item.tierIndex || 0}.stock`;
            if (difference > 0) {
                const result = await Product.updateOne(
                    { _id: item.product, [stockPath]: { $gte: difference } },
                    { $inc: { [stockPath]: -difference } },
                    { session }
                );
                if (result.modifiedCount !== 1) {
                    const error = new Error('Requested quantity exceeds available stock');
                    error.statusCode = 400;
                    throw error;
                }
            } else if (difference < 0) {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { [stockPath]: -difference } },
                    { session }
                );
            }

            item.qty = requestedQty;
            const newTotalPrice = order.orderItems.reduce(
                (sum, orderItem) => sum + (orderItem.price * orderItem.qty),
                0
            );

            let deliveryFee = 0;

            const appSettings = await Setting.findOne().session(session);
            const logistics = appSettings?.logistics;
            const userType = order.type || 'Retail';
            const rule = logistics?.[userType];

            if (rule?.mov != null && rule?.deliveryCharge != null && newTotalPrice < rule.mov) {
                deliveryFee = rule.deliveryCharge;
            }

            order.deliveryFee = deliveryFee;
            order.totalPrice = Math.round(newTotalPrice + deliveryFee);
            await order.save({ session });
        });

        // Fetch completely fresh order to return
        const freshOrder = await Order.findById(req.params.id)
            .populate('admin', 'name email')
            .populate('orderItems.product', 'name brand weight');

        res.json(freshOrder);
    } catch (error) {
        console.error("Error in updateQuantity:", error);
        res.status(error.statusCode || 500).json({ message: error.message });
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
            .select('orderItems.image orderItems.name orderItems.qty orderItems.price orderItems.unit orderItems.weight orderItems.tierLabel orderItems.tierIndex orderItems.product shippingAddress paymentMethod totalPrice status isDelivered createdAt')
            .populate('orderItems.product', 'name brand weight')
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
            .populate('orderItems.product', 'name brand weight')
            .lean();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
