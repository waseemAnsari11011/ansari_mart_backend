const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../src/modules/User/model');
const Admin = require('../src/modules/Admin/model');
const controller = require('../src/modules/User/controller');
const { protect, protectUser, protectAny } = require('../src/modules/Middleware/authMiddleware');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });
const id = '507f1f77bcf86cd799439011';

test('bulk deletion only marks selected active records, records admin and invalidates sessions', async t => {
    const admin = new mongoose.Types.ObjectId();
    t.mock.method(User, 'updateMany', async (filter, update) => {
        assert.deepEqual(filter, { _id: { $in: [id] }, deletedAt: null });
        assert.ok(update.$set.deletedAt instanceof Date);
        assert.equal(update.$set.deletedBy, admin);
        assert.deepEqual(Object.keys(update.$set).sort(), ['deletedAt', 'deletedBy']);
        assert.deepEqual(update.$inc, { authVersion: 1 });
        return { modifiedCount: 1 };
    });
    const res = response();
    await controller.softDeleteCustomers({ body: { ids: [id, id.toUpperCase()] }, user: { _id: admin } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.deletedCount, 1);
    assert.deepEqual(res.data.ids, [id]);
});

test('empty, malformed and excessive selections never write', async t => {
    const write = t.mock.method(User, 'updateMany', () => { throw new Error('Must not write'); });
    for (const ids of [undefined, [], [id, 'invalid'], [123], Array(501).fill(id), { $ne: null }]) {
        const res = response();
        await controller.softDeleteCustomers({ body: { ids } }, res);
        assert.equal(res.statusCode, 400);
    }
    assert.equal(write.mock.callCount(), 0);
});

test('repeat deletion is safe and deleted customers are excluded from list queries', async t => {
    t.mock.method(User, 'updateMany', async () => ({ modifiedCount: 0 }));
    const res = response();
    await controller.softDeleteCustomers({ body: { ids: [id] }, user: { _id: id } }, res);
    assert.equal(res.data.deletedCount, 0);
    t.mock.method(User, 'find', query => {
        assert.deepEqual(query, { deletedAt: null, type: 'Retail' });
        return { sort: async () => [] };
    });
    await controller.getAllUsers({ query: { type: 'Retail' } }, response());
    const route = require('../src/modules/User/route').stack.find(layer => layer.route?.path === '/bulk-delete').route;
    assert.equal(route.methods.post, true);
    assert.equal(route.stack[0].handle, protect);
});

test('deleted phone cannot receive login OTP or log in again', async t => {
    t.mock.method(User, 'findOne', async () => ({ deletedAt: new Date(), type: 'Retail' }));
    for (const method of ['sendOtp', 'verifyOtp']) {
        const res = response();
        await controller[method]({ body: { phone: '9000000004', type: 'Retail', otp: '1234' } }, res);
        assert.equal(res.statusCode, 403);
        assert.match(res.data.message, /deleted/);
    }
});

test('deleted customers cannot use existing sessions even with a matching auth version', async t => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'soft-delete-test';
    t.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });
    const user = new User({ phone: '9000000004', deletedAt: new Date(), authVersion: 1 });
    t.mock.method(User, 'findById', () => ({ select: async () => user }));
    t.mock.method(Admin, 'findById', () => ({ select: async () => null }));
    const token = jwt.sign({ id: user._id, authVersion: 1 }, process.env.JWT_SECRET);
    for (const middleware of [protectUser, protectAny]) {
        let continued = false;
        const res = response();
        await middleware({ headers: { authorization: `Bearer ${token}` } }, res, () => { continued = true; });
        assert.equal(res.statusCode, 401);
        assert.equal(continued, false);
    }
});
