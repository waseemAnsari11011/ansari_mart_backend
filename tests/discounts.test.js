const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDiscountRules, calculateDiscount, priceOrder } = require('../src/utils/discounts');
const rule = changes => ({ name: 'Offer', active: true, customerType: 'All', firstOrderOnly: false, minSubtotal: 0, maxSubtotal: null, discountType: 'fixed', value: 50, ...changes });

test('historical snapshots retain their original inclusive range boundaries', () => {
    const upTo = [rule({ maxSubtotal: 2000 })];
    assert.equal(calculateDiscount(upTo, 2000, 'Retail', false).discountAmount, 50);
    assert.equal(calculateDiscount(upTo, 2000.01, 'Retail', false).discountAmount, 0);
    const above = [rule({ minSubtotal: 2000 })];
    assert.equal(calculateDiscount(above, 1999, 'Retail', false).discountAmount, 0);
    assert.equal(calculateDiscount(above, 2000, 'Retail', false).discountAmount, 50);
});
test('best eligible offer wins without stacking', () => {
    const rules = [rule(), rule({ name: 'Welcome', firstOrderOnly: true, value: 100 }), rule({ active: false, value: 1000 }), rule({ customerType: 'Business', value: 200 })];
    assert.deepEqual(calculateDiscount(rules, 2000, 'Retail', true), { discountAmount: 100, discountName: 'Welcome' });
    assert.equal(calculateDiscount(rules, 2000, 'Retail', false).discountAmount, 50);
    assert.equal(calculateDiscount(rules, 2000, 'Business', true).discountAmount, 200);
});
test('discount is capped to merchandise, excludes delivery, and rounds to paise', () => {
    assert.deepEqual(priceOrder(30, 20, [rule()], 'Retail', false), { subtotal: 30, deliveryFee: 20, discountAmount: 30, discountName: 'Offer', totalPrice: 20 });
    assert.equal(priceOrder(999, 20, [rule({ discountType: 'percentage', value: 12.5 })], 'Retail', false).totalPrice, 894.12);
    assert.equal(priceOrder(0, 20, [rule()], 'Retail', false).discountAmount, 0);
    assert.equal(priceOrder(500, 20, undefined, 'Retail', false).totalPrice, 520);
});
test('invalid configurations are rejected', () => {
    for (const changes of [{ value: -1 }, { value: 0 }, { value: Infinity }, { value: '50' }, { discountType: 'percentage', value: 101 }, { minSubtotal: 2000, maxSubtotal: 1000 }, { active: 'false' }, { firstOrderOnly: 'true' }, { customerType: 'Unknown' }, { name: ' ' }, { minSubtotal: null }]) assert.throws(() => validateDiscountRules([rule(changes)]));
    assert.throws(() => validateDiscountRules({}));
    assert.throws(() => validateDiscountRules(Array(51).fill(rule())));
    assert.deepEqual(validateDiscountRules([]), []);
});
test('preview and creation use server prices, history, and a customer checkout lock', async t => {
    process.env.NODE_ENV = 'development';
    const mongoose = require('mongoose');
    const User = require('../src/modules/User/model');
    const Product = require('../src/modules/Product/model');
    const Order = require('../src/modules/Order/model');
    const Setting = require('../src/modules/Setting/model');
    const controller = require('../src/modules/Order/controller');
    const productId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const session = {};
    let previousOrder = false;
    let locked = false;
    let created;
    const query = value => ({ session: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
    t.mock.method(User, 'findById', async () => ({ _id: userId, type: 'Retail' }));
    t.mock.method(User, 'updateOne', async (filter, update, options) => {
        assert.equal(String(filter._id), String(userId));
        assert.equal(update.$inc.checkoutSequence, 1);
        assert.equal(options.session, session);
        locked = true;
    });
    t.mock.method(Order, 'exists', () => query(previousOrder));
    t.mock.method(Product, 'findById', () => query({ _id: productId, name: 'Rice', images: ['rice.jpg'], retailPricing: [{ price: 1000, stock: 100 }], save: async () => {} }));
    t.mock.method(Setting, 'findOne', () => query({ logistics: { Retail: { mov: 2000, deliveryCharge: 20 } }, discountRules: [rule({ threshold: 1999 }), rule({ name: 'Welcome', value: 100, firstOrderOnly: true })] }));
    t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
    t.mock.method(Order, 'create', async ([order]) => { assert.equal(locked, true); created = { ...order, _id: 'order' }; return [created]; });
    const request = { user: { _id: userId, type: 'Retail' }, body: { orderItems: [{ product: String(productId), qty: 2, price: 1 }], discountAmount: 1999, totalPrice: 1 } };
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });
    let res = response();
    await controller.previewOrder(request, res);
    assert.equal(res.data.totalPrice, 1900);
    res = response();
    await controller.addOrderItems(request, res);
    assert.equal(res.statusCode, 201);
    assert.equal(created.totalPrice, 1900);
    assert.equal(created.firstOrderAtCheckout, true);
    assert.equal(created.discountRulesSnapshot.length, 2);
    previousOrder = { _id: 'previous' };
    res = response();
    await controller.addOrderItems(request, res);
    assert.equal(created.totalPrice, 1950);
    assert.equal(created.firstOrderAtCheckout, false);
    res = response();
    await controller.addOrderItems({ ...request, body: { ...request.body, expectedTotal: 1900 } }, res);
    assert.equal(res.statusCode, 409);
    assert.match(res.data.message, /total changed/);
    assert.equal(priceOrder(500, 20, created.discountRulesSnapshot, 'Retail', true).totalPrice, 420);
    t.mock.method(Setting, 'findOne', () => query({ discountRules: [rule({ threshold: 1999, discountType: 'product_price', productPrices: [{ product: String(productId), tierIndex: 0, offerPrice: 1 }] })] }));
    res = response();
    await controller.previewOrder(request, res);
    assert.equal(res.data.totalPrice, 1001);
    assert.equal(res.data.discountProducts[0].offerPrice, 1);
    res = response();
    await controller.addOrderItems(request, res);
    assert.equal(res.statusCode, 201);
    assert.equal(created.totalPrice, 1001);
    assert.equal(created.discountAmount, 999);
    assert.equal(created.discountProducts[0].qty, 1);

});

test('admin quantity and price edits recalculate saved offers, preserving historical eligibility', async t => {
    const mongoose = require('mongoose');
    const Order = require('../src/modules/Order/model');
    const Setting = require('../src/modules/Setting/model');
    const controller = require('../src/modules/Order/controller');
    const item = { _id: 'item', price: 2000, qty: 1 };
    const items = [item];
    items.id = id => id === 'item' ? item : null;
    const order = { status: 'Pending', type: 'Retail', orderItems: items, discountRulesSnapshot: [rule({ minSubtotal: 2000 })], firstOrderAtCheckout: true, save: async () => {} };
    const query = { select() { return this; }, session: async () => order, populate() { return this; }, then: (resolve, reject) => Promise.resolve(order).then(resolve, reject) };
    t.mock.method(Order, 'findById', () => query);
    // A changed live campaign must not replace the saved offer.
    t.mock.method(Setting, 'findOne', () => ({ session: async () => ({ discountRules: [rule({ value: 500 })], logistics: { Retail: { mov: 2000, deliveryCharge: 20 } } }) }));
    t.mock.method(mongoose.connection, 'transaction', async callback => callback({}));
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; } });
    let res = response();
    await controller.updateOrderItemQuantity({ params: { id: 'order' }, body: { itemId: 'item', qty: 1 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(order.totalPrice, 1950);
    res = response();
    await controller.updateOrderItemPrice({ params: { id: 'order' }, body: { itemId: 'item', price: 1999 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(order.discountAmount, 0);
    assert.equal(order.totalPrice, 2019);
    order.discountRulesSnapshot = [rule({ firstOrderOnly: true, value: 100 })];
    res = response();
    await controller.updateOrderItemPrice({ params: { id: 'order' }, body: { itemId: 'item', price: 500 } }, res);
    assert.equal(order.totalPrice, 420);
    delete order.discountRulesSnapshot;
    res = response();
    await controller.updateOrderItemPrice({ params: { id: 'order' }, body: { itemId: 'item', price: 500 } }, res);
    assert.equal(order.totalPrice, 520); // Legacy orders receive no new campaign retroactively.
});

test('live legacy maximum becomes a strict lower threshold; saved snapshots stay unchanged', () => {
    const { normalizeLiveRules } = require('../src/utils/discounts');
    const saved = [rule({ maxSubtotal: 2000 })];
    const live = normalizeLiveRules(saved);
    for (const subtotal of [100, 1999, 2000]) assert.equal(priceOrder(subtotal, 0, live, 'Retail', false).discountAmount, 0);
    assert.equal(priceOrder(2064, 0, live, 'Retail', false).totalPrice, 2014);
    assert.equal(priceOrder(2000.01, 0, live, 'Retail', false).discountAmount, 50);
    assert.equal(saved[0].threshold, undefined);
    assert.equal(priceOrder(100, 0, saved, 'Retail', false).discountAmount, 50);
});

test('product offers discount one unit without a spend requirement or surcharges', () => {
    const product = '507f1f77bcf86cd799439011';
    const items = [{ product, tierIndex: 0, price: 100, qty: 2 }, { product, tierIndex: 1, price: 500, qty: 1 }];
    const offer = rule({ threshold: 200, discountType: 'product_price', productPrices: [{ product, tierIndex: 0, offerPrice: 1 }] });
    let result = priceOrder(700, 40, [offer], 'Retail', false, items);
    assert.equal(result.discountAmount, 99);
    assert.equal(result.totalPrice, 641);
    assert.equal(result.discountProducts[0].offerPrice, 1);
    assert.equal(priceOrder(200, 40, [offer], 'Retail', false, items.slice(0, 1)).discountAmount, 99);
    assert.equal(priceOrder(700, 0, [{ ...offer, firstOrderOnly: true }], 'Retail', false, items).discountAmount, 0);
    assert.equal(priceOrder(700, 0, [{ ...offer, customerType: 'Business' }], 'Retail', false, items).discountAmount, 0);
    assert.equal(priceOrder(700, 0, [offer], 'Retail', false, [{ product, tierIndex: 0, price: 0.5, qty: 1 }]).discountAmount, 0);
    result = priceOrder(700, 0, [offer, rule({ value: 250 })], 'Retail', false, items);
    assert.equal(result.discountAmount, 250);
    assert.equal(result.discountProducts, undefined);
    assert.equal(priceOrder(700, 0, [offer], 'Retail', false, []).discountAmount, 0);
});

test('product offer validation rejects missing products, duplicate variants and invalid prices', () => {
    const selected = { product: '507f1f77bcf86cd799439011', tierIndex: 0, offerPrice: 1 };
    const offer = rule({ threshold: 2000, discountType: 'product_price', productPrices: [selected] });
    assert.equal(validateDiscountRules([offer])[0].productPrices[0].offerPrice, 1);
    for (const productPrices of [[], [selected, selected], [{ ...selected, product: 'invalid' }], [{ ...selected, tierIndex: -1 }], [{ ...selected, offerPrice: -1 }], [{ ...selected, offerPrice: NaN }]]) assert.throws(() => validateDiscountRules([{ ...offer, productPrices }]));
});

test('five selected products across rules grant only the greatest single-unit saving', () => {
    const products = Array.from({ length: 5 }, (_, index) => `507f1f77bcf86cd79943901${index}`);
    const items = products.map((product, index) => ({ product, tierIndex: 0, price: 100 + index * 10, qty: 3 }));
    const offer = rule({ discountType: 'product_price', threshold: 10000, minSubtotal: 10000, maxSubtotal: 20000,
        productPrices: products.map(product => ({ product, tierIndex: 0, offerPrice: 1 })) });
    let result = priceOrder(1800, 40, [offer], 'Retail', false, items);
    assert.equal(result.discountAmount, 139);
    assert.equal(result.totalPrice, 1701);
    assert.deepEqual(result.discountProducts, [{ product: products[4], tierIndex: 0, offerPrice: 1, qty: 1 }]);
    result = priceOrder(1800, 40, offer.productPrices.map(selected => ({ ...offer, productPrices: [selected] })), 'Retail', false, items);
    assert.equal(result.discountAmount, 139);
    assert.equal(result.discountProducts.length, 1);
    // Splitting the same product into multiple cart lines cannot increase the saving.
    result = priceOrder(200, 0, [offer], 'Retail', false, [items[0], items[0]].map(item => ({ ...item, qty: 1 })));
    assert.equal(result.discountAmount, 99);
    assert.equal(result.discountProducts[0].qty, 1);
    assert.equal(priceOrder(100, 0, [offer], 'Retail', false, [{ ...items[0], qty: 0 }]).discountAmount, 0);
});

test('new product settings clear spend threshold while old order snapshots keep their original terms', () => {
    const { normalizeLiveRules, normalizeSnapshotRules } = require('../src/utils/discounts');
    const product = '507f1f77bcf86cd799439011';
    const offer = rule({ discountType: 'product_price', threshold: 500, productPrices: [{ product, tierIndex: 0, offerPrice: 1 }] });
    const items = [{ product, tierIndex: 0, price: 100, qty: 10 }];
    const live = normalizeLiveRules([offer]);
    assert.equal(live[0].threshold, 0);
    assert.equal(validateDiscountRules([offer])[0].threshold, 0);
    assert.equal(priceOrder(1000, 0, live, 'Retail', false, items).discountAmount, 99);
    assert.equal(priceOrder(1000, 0, normalizeSnapshotRules([offer]), 'Retail', false, items).discountAmount, 990);
    assert.equal(priceOrder(100, 0, normalizeSnapshotRules([offer]), 'Retail', false, [{ ...items[0], qty: 1 }]).discountAmount, 0);
    // New order snapshots retain the single-unit policy when edited.
    assert.equal(priceOrder(1000, 0, normalizeSnapshotRules(live), 'Retail', false, items).discountAmount, 99);
});

test('cart offer visibility tracks customer type, first orders, strict spend thresholds and selected packs', () => {
    const { getCartOffers, normalizeLiveRules } = require('../src/utils/discounts');
    const product = '000000000000000000000001';
    const rules = normalizeLiveRules([
        rule({ name: 'Spend', threshold: 500 }),
        rule({ name: 'Welcome', firstOrderOnly: true }),
        rule({ name: 'Business', customerType: 'Business' }),
        rule({ name: 'Inactive', active: false }),
        rule({ name: 'Deal', discountType: 'product_price', value: 0, productPrices: [{ product, tierIndex: 1, offerPrice: 104 }] }),
    ]);
    const items = [{ product, tierIndex: 0, qty: 1, price: 149 }];
    let offers = getCartOffers(rules, 500, 'Retail', false, items);
    assert.equal(offers.length, 3);
    assert.equal(offers.find(o => o.name === 'Spend').extraSpend, 1);
    assert.equal(offers.find(o => o.name === 'Welcome').status, 'first_order_only');
    assert.equal(offers.find(o => o.name === 'Deal').status, 'select_option');
    offers = getCartOffers(rules, 501, 'Retail', true, [{ ...items[0], tierIndex: 1 }]);
    assert.equal(offers.find(o => o.name === 'Spend').saving, 50);
    assert.equal(offers.find(o => o.name === 'Welcome').status, 'eligible');
    assert.equal(offers.find(o => o.name === 'Deal').saving, 45);
    assert.equal(getCartOffers(rules, 149, 'Retail', true, []).some(o => o.name === 'Deal'), false);
});

test('order value product offer supports free or special prices at the inclusive spend threshold', () => {
    const { getCartOffers, normalizeLiveRules, normalizeSnapshotRules } = require('../src/utils/discounts');
    const product = '000000000000000000000001';
    const [offer] = validateDiscountRules([rule({ discountType: 'order_product_price', threshold: 1000, value: 0, productPrices: [{ product, tierIndex: 0, offerPrice: 0 }] })]);
    const items = [{ product, tierIndex: 0, price: 60, qty: 3 }];
    assert.equal(offer.threshold, 1000);
    assert.equal(normalizeLiveRules([offer])[0].threshold, 1000);
    assert.equal(priceOrder(999, 40, [offer], 'Retail', true, items).discountAmount, 0);
    const priced = priceOrder(1000, 40, [offer], 'Retail', true, items);
    assert.equal(priced.discountAmount, 60);
    assert.equal(priced.totalPrice, 980);
    assert.equal(priced.discountProducts[0].qty, 1);
    assert.equal(priced.discountProducts[0].offerPrice, 0);
    assert.equal(priceOrder(1000, 0, [offer], 'Retail', true, []).discountAmount, 0);
    assert.equal(priceOrder(1000, 0, [offer], 'Retail', true, [{ ...items[0], tierIndex: 1 }]).discountAmount, 0);
    assert.equal(priceOrder(1000, 0, [{ ...offer, productPrices: [{ product, tierIndex: 0, offerPrice: 20 }] }], 'Retail', true, items).discountAmount, 40);
    assert.equal(priceOrder(1000, 0, [offer, rule({ value: 100 })], 'Retail', true, items).discountAmount, 100);
    assert.equal(priceOrder(1000, 0, [{ ...offer, customerType: 'Business' }], 'Retail', true, items).discountAmount, 0);
    assert.equal(priceOrder(1000, 0, [{ ...offer, firstOrderOnly: true }], 'Retail', false, items).discountAmount, 0);
    assert.equal(priceOrder(1000, 0, normalizeSnapshotRules([offer]), 'Retail', true, items).discountAmount, 60);
    const pending = getCartOffers([offer], 900, 'Retail', true, [])[0];
    assert.equal(pending.status, 'spend_more');
    assert.equal(pending.extraSpend, 100);
    assert.equal(getCartOffers([offer], 1000, 'Retail', true, [])[0].status, 'select_option');
    assert.equal(getCartOffers([offer], 1000, 'Retail', true, items)[0].status, 'eligible');
    assert.throws(() => validateDiscountRules([{ ...offer, threshold: -1 }]));
    assert.throws(() => validateDiscountRules([{ ...offer, productPrices: [] }]));
    assert.throws(() => validateDiscountRules([{ ...offer, productPrices: [{ product, tierIndex: 0, offerPrice: -1 }] }]));
});
