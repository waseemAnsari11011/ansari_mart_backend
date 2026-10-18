const Setting = require('./model');

// Get Settings
exports.getSettings = async (req, res) => {
    try {
        let settings = await Setting.findOne();

        if (!settings) {
            settings = await Setting.create({
                banners: [],
                logistics: {
                    Retail: { mov: 0, deliveryCharge: 0 },
                    Business: { mov: 0, deliveryCharge: 0 }
                },
                units: ['Unit']
            });
        }

        res.status(200).json(settings);

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Update Banners
exports.updateBanners = async (req, res) => {
    try {
        const { banners } = req.body;
        let settings = await Setting.findOne();
        if (!settings) {
            settings = new Setting();
        }
        settings.banners = banners;
        await settings.save();
        res.status(200).json({ message: "Banners updated successfully", settings });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Update Logistics
exports.updateLogistics = async (req, res) => {
    try {
        const { logistics } = req.body;

        let settings = await Setting.findOne();
        if (!settings) {
            settings = new Setting();
        }

        // 🔥 SAFE INIT (important)
        if (!settings.logistics) {
            settings.logistics = {
                Retail: { mov: 0, deliveryCharge: 0 },
                Business: { mov: 0, deliveryCharge: 0 }
            };
        }

        if (logistics.Retail) {
            settings.logistics.Retail = {
                mov: Number(logistics.Retail.mov || 0),
                deliveryCharge: Number(logistics.Retail.deliveryCharge || 0)
            };
        }

        if (logistics.Business) {
            settings.logistics.Business = {
                mov: Number(logistics.Business.mov || 0),
                deliveryCharge: Number(logistics.Business.deliveryCharge || 0)
            };
        }

        settings.markModified('logistics');
        await settings.save();

        res.status(200).json({
            message: "Logistics updated successfully",
            settings
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

// Update Units
exports.updateUnits = async (req, res) => {
    try {
        const { units } = req.body;
        let settings = await Setting.findOne();
        if (!settings) {
            settings = new Setting();
        }
        settings.units = units;
        await settings.save();
        res.status(200).json({ message: "Units updated successfully", settings });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// Discount settings are validated before persisting and writable only by admins.
exports.updateDiscounts = async (req, res) => {
    let discountRules;
    try {
        discountRules = require('../../utils/discounts').validateDiscountRules(req.body.discountRules);
    } catch (error) {
        return res.status(400).json({ message: error.message });
    }
    try {
        const Product = require('../Product/model');
        for (const rule of discountRules.filter(rule => ['product_price', 'order_product_price'].includes(rule.discountType))) {
            for (const selected of rule.productPrices) {
                const product = await Product.findById(selected.product);
                const types = rule.customerType === 'All' ? ['Retail', 'Business'] : [rule.customerType];
                if (!product || types.some(type => !product[type === 'Retail' ? 'retailPricing' : 'businessPricing']?.[selected.tierIndex])) {
                    return res.status(400).json({ message: 'Selected product option is unavailable for the chosen customer type. Select Retail or Business if the options differ.' });
                }
            }
        }
        const settings = await Setting.findOneAndUpdate({}, { $set: { discountRules } }, { new: true, upsert: true, runValidators: true });
        res.json({ message: 'Discounts saved', settings });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
