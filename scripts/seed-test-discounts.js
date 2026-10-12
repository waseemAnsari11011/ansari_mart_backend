require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Product = require('../src/modules/Product/model');
const Setting = require('../src/modules/Setting/model');
const { validateDiscountRules } = require('../src/utils/discounts');

async function run() {
    const database = String(process.env.DB_NAME || '').trim();
    if (!/test$/i.test(database)) throw new Error('Sample offers require a test database');
    const uri = `mongodb+srv://${encodeURIComponent(process.env.MONGO_USERNAME)}:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${process.env.MONGO_HOST}/${database}?retryWrites=true&w=majority`;
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    const settings = await Setting.findOne();
    if (!settings) throw new Error('Seed the test catalog and settings first');
    const products = await Product.find({ retailStatus: 'Active', businessStatus: 'Active' }).sort({ _id: 1 }).lean();
    const rules = [];
    for (const customerType of ['All', 'Retail', 'Business']) {
        const fields = customerType === 'All' ? ['retailPricing', 'businessPricing'] : [customerType === 'Business' ? 'businessPricing' : 'retailPricing'];
        const eligible = products.filter(product => fields.every(field => product[field]?.[0]?.price > 0 && product[field][0].stock > 0)).slice(0, 2);
        if (!eligible.length) throw new Error(`No stocked product options for ${customerType}`);
        for (const firstOrderOnly of [false, true]) {
            const base = { active: true, customerType, firstOrderOnly, minSubtotal: 0, maxSubtotal: null, productPrices: [] };
            const prefix = `[UI TEST] ${customerType}${firstOrderOnly ? ' welcome' : ''}`;
            rules.push({ ...base, name: `${prefix}: ₹${firstOrderOnly ? 100 : 50} off`, discountType: 'fixed', value: firstOrderOnly ? 100 : 50, threshold: firstOrderOnly ? 0 : 699 });
            rules.push({ ...base, name: `${prefix}: ${firstOrderOnly ? 15 : 10}% savings`, discountType: 'percentage', value: firstOrderOnly ? 15 : 10, threshold: firstOrderOnly ? 499 : 1299 });
            rules.push({ ...base, name: `${prefix}: ${eligible[0].name} special price`, discountType: 'product_price', value: 0, threshold: 0,
                productPrices: eligible.map(product => ({ product: String(product._id), tierIndex: 0, offerPrice: Math.round(Math.min(...fields.map(field => product[field][0].price)) * 0.7 * 100) / 100 })) });
        }
    }
    for (const [value, threshold] of [[100, 1299], [150, 1899], [200, 2499]]) {
        rules.push({ name: `[UI TEST] Spend & save: ₹${value} off above ₹${threshold}`, active: true, customerType: 'All', firstOrderOnly: false, discountType: 'fixed', value, threshold, minSubtotal: 0, maxSubtotal: null, productPrices: [] });
    }
    rules.push({ name: '[UI TEST] Inactive offer — should stay hidden', active: false, customerType: 'All', firstOrderOnly: false, discountType: 'fixed', value: 500, threshold: 0, minSubtotal: 0, maxSubtotal: null, productPrices: [] });
    const validated = validateDiscountRules(rules);
    const existing = settings.discountRules.map(rule => rule.toObject());
    const names = new Set(existing.map(rule => rule.name));
    const additions = validated.filter(rule => !names.has(rule.name));
    if (existing.length + additions.length > 50) throw new Error('Not enough room under the 50-offer limit');
    settings.discountRules = [...existing, ...additions];
    await settings.save();
    console.log(JSON.stringify({ database, added: additions.length, total: settings.discountRules.length, sampleOffers: validated.map(rule => ({ name: rule.name, type: rule.discountType, active: rule.active })) }, null, 2));
}

run().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
