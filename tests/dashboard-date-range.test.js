const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function request(query) {
    const calls = {};
    const order = {
        aggregate: async pipeline => { calls.sales = pipeline[0].$match; return [{ totalSales: 123 }]; },
        countDocuments: async filter => { calls.orders = filter; return 2; },
        find: filter => {
            calls.recent = filter;
            const chain = { sort: () => chain, limit: () => chain, populate: () => chain, lean: async () => [] };
            return chain;
        }
    };
    const user = { countDocuments: async filter => { (calls.users ||= []).push(filter); return 1; } };
    const product = { countDocuments: async filter => { calls.stock = filter; return 0; } };
    const exports = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/modules/Admin/controller.js'), 'utf8'), {
        exports, require: name => ({ '../Order/model': order, '../User/model': user, '../Product/model': product }[name] || {})
    });
    const result = { status: 200 };
    const res = { status: code => { result.status = code; return res; }, json: body => { result.body = body; } };
    await exports.getDashboardStats({ query }, res);
    return { calls, result };
}

test('dashboard applies date boundaries to metrics and recent orders, preserving current alerts', async () => {
    const query = { startDate: '2026-09-30T18:30:00.000Z', endDate: '2026-10-01T18:30:00.000Z' };
    const { calls, result } = await request(query);
    assert.equal(result.status, 200);
    for (const filter of [calls.sales, calls.orders, calls.recent, ...calls.users.slice(0, 2)]) {
        assert.equal(filter.createdAt.$gte.toISOString(), query.startDate);
        assert.equal(filter.createdAt.$lt.toISOString(), query.endDate);
    }
    assert.equal(calls.sales.status.$ne, 'Cancelled');
    assert.equal(calls.users[2].createdAt, undefined);
    assert.equal(calls.stock.createdAt, undefined);
});

test('all-time dashboard remains unfiltered', async () => {
    const { calls, result } = await request({});
    assert.equal(result.status, 200);
    assert.equal(calls.orders.createdAt, undefined);
});

test('invalid, incomplete and reversed ranges are rejected before querying', async () => {
    for (const query of [{ startDate: 'bad', endDate: 'bad' }, { startDate: '2026-10-01' }, { startDate: '2026-10-02', endDate: '2026-10-01' }]) {
        const { calls, result } = await request(query);
        assert.equal(result.status, 400);
        assert.deepEqual(calls, {});
    }
});
