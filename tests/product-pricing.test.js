const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validatePricing } = require('../src/modules/Product/validation');
const Product = require('../src/modules/Product/model');
const Setting = require('../src/modules/Setting/model');
const controller = require('../src/modules/Product/controller');
const tier = { price: 10, stock: 0, unit: 'Kg', label: '' };
test('active requires tiers; inactive allows empty; zero stock and optional label are valid', () => {
    assert.ok(validatePricing([], 'Business', 'Active', ['Kg']));
    assert.equal(validatePricing([], 'Business', 'Inactive', ['Kg']), null);
    assert.equal(validatePricing([tier], 'Business', 'Active', ['Kg']), null);
});
test('all added tiers require positive price, whole nonnegative stock and configured unit', () => {
    for (const invalid of [{ price: undefined }, { price: '' }, { stock: '' }, { price: 0 }, { price: -1 }, { price: Infinity }, { stock: -1 }, { stock: 1.5 }, { unit: '' }, { unit: 'invalid' }]) {
        assert.match(validatePricing([tier, { ...tier, ...invalid }], 'Business', 'Inactive', ['Kg']), /Business Tier 2:/);
    }
});
test('schema rejects incomplete rows', () => {
    const base = { name: 'Test', description: 'Test', admin: '507f1f77bcf86cd799439011', category: '507f1f77bcf86cd799439012' };
    assert.equal(new Product({ ...base, businessPricing: [tier] }).validateSync(), undefined);
    for (const row of [{}, { ...tier, price: 0 }, { ...tier, stock: 1.5 }, { ...tier, stock: undefined }, { ...tier, unit: '' }]) assert.ok(new Product({ ...base, businessPricing: [row] }).validateSync());
});
test('create and update reject invalid tiers before writes', async t => {
    t.mock.method(Setting, 'findOne', async () => ({ units: ['Kg'] }));
    let writes = 0;
    t.mock.method(Product, 'create', async () => { writes++; });
    t.mock.method(Product, 'findById', async () => ({ retailStatus: 'Active', businessStatus: 'Active', retailPricing: [tier], businessPricing: [tier], save: async () => { writes++; } }));
    for (const handler of [controller.createProduct, controller.updateProduct]) {
        for (const pricing of [[], [{ ...tier, price: 0 }], [{ ...tier, stock: '' }], [{ ...tier, unit: 'invalid' }]]) {
            const res = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
            await handler({ body: { retailPricing: [tier], businessPricing: pricing }, params: { id: 'test' }, user: { _id: 'test' } }, res);
            assert.equal(res.code, 400);
        }
    }
    assert.equal(writes, 0);
});
