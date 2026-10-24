const Order = require('../Order/model');
const { buildTrendQuery, formatTrendResult } = require('./orderTrends');

exports.getOrderTrends = async (req, res) => {
    let config;
    try {
        config = buildTrendQuery(req.query);
    } catch {
        return res.status(400).json({ message: 'Select a valid period, customer type and order status.' });
    }
    try {
        const rows = await Order.aggregate(config.pipeline);
        return res.json(formatTrendResult(config, rows));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
