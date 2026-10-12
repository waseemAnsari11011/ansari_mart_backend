const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../src/modules/User/model');
const Admin = require('../src/modules/Admin/model');
const controller = require('../src/modules/User/controller');
const { protectUser, protectAny, protect } = require('../src/modules/Middleware/authMiddleware');
const jwt = require('jsonwebtoken');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } });

test('conversion preserves identity and details, clears retail cart, and requires new login and KYC', async t => {
    const current = new User({ phone: '9000000001', name: 'Customer', type: 'Retail', status: 'Active', businessDetails: { gstNo: 'existing', verificationStatus: 'Approved' } });
    t.mock.method(User, 'findById', async () => current);
    t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => {
        assert.equal(String(filter._id), String(current._id));
        assert.equal(filter.type, 'Retail');
        assert.equal(filter.status, 'Active');
        assert.equal(update.$set.type, 'Business');
        assert.equal(update.$set.status, 'Pending');
        assert.equal(update.$set.businessDetails.gstNo, 'existing');
        assert.equal(update.$set.businessDetails.shopName, 'Test Shop');
        assert.equal(update.$set.businessDetails.verificationStatus, 'Pending');
        assert.deepEqual(update.$set.cart, []);
        assert.equal(update.$inc.authVersion, 1);
        for (const field of ['phone', 'addresses', '_id', 'name']) assert.equal(update.$set[field], undefined);
        assert.equal(options.runValidators, true);
        return { select: async fields => { assert.equal(fields, '-password'); return { _id: current._id, ...update.$set }; } };
    });
    const res = response();
    await controller.convertToBusiness({ params: { id: String(current._id) }, body: { shopName: ' Test Shop ', verificationStatus: 'Approved' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.user.type, 'Business');
});

test('blocked customers remain blocked and concurrent changes are not overwritten', async t => {
    const current = new User({ phone: '9000000002', type: 'Retail', status: 'Blocked' });
    t.mock.method(User, 'findById', async () => current);
    t.mock.method(User, 'findOneAndUpdate', (filter, update) => {
        assert.equal(filter.status, 'Blocked');
        assert.equal(update.$set.status, 'Blocked');
        return { select: async () => null };
    });
    const res = response();
    await controller.convertToBusiness({ params: { id: String(current._id) }, body: {} }, res);
    assert.equal(res.statusCode, 409);
});

test('conversion validates customer, role and input before writing', async t => {
    let current = null;
    t.mock.method(User, 'findById', async () => current);
    const write = t.mock.method(User, 'findOneAndUpdate', () => { throw new Error('Must not write'); });
    for (const [id, user, body, expected] of [
        ['bad', null, {}, 400],
        [String(new mongoose.Types.ObjectId()), null, {}, 404],
        [String(new mongoose.Types.ObjectId()), { type: 'Business' }, {}, 409],
        [String(new mongoose.Types.ObjectId()), { type: 'Retail' }, { shopName: {} }, 400],
    ]) {
        current = user;
        const res = response();
        await controller.convertToBusiness({ params: { id }, body }, res);
        assert.equal(res.statusCode, expected);
    }
    assert.equal(write.mock.callCount(), 0);
});

test('conversion endpoint is admin protected', () => {
    const router = require('../src/modules/User/route');
    const route = router.stack.find(layer => layer.route?.path === '/:id/convert-to-business').route;
    assert.equal(route.methods.patch, true);
    assert.equal(route.stack[0].handle, protect);
});

test('old customer sessions are rejected on both customer and order routes; new login token works', async t => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'customer-conversion-test-secret';
    t.after(() => { if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret; });
    const user = new User({ phone: '9000000003', type: 'Business', status: 'Pending', authVersion: 1 });
    t.mock.method(User, 'findById', () => ({ select: async () => user }));
    t.mock.method(Admin, 'findById', () => ({ select: async () => null }));
    for (const middleware of [protectUser, protectAny]) {
        let next = false;
        const stale = response();
        await middleware({ headers: { authorization: `Bearer ${jwt.sign({ id: String(user._id), type: 'Retail' }, process.env.JWT_SECRET)}` } }, stale, () => { next = true; });
        assert.equal(stale.statusCode, 401);
        assert.equal(next, false);
    }
    t.mock.method(User, 'findOne', async () => user);
    const login = response();
    await controller.verifyOtp({ body: { phone: user.phone, otp: '1234', type: 'Business' } }, login);
    assert.equal(login.statusCode, 200);
    assert.equal(jwt.verify(login.data.token, process.env.JWT_SECRET).authVersion, 1);
    for (const middleware of [protectUser, protectAny]) {
        let next = false;
        await middleware({ headers: { authorization: `Bearer ${login.data.token}` } }, response(), () => { next = true; });
        assert.equal(next, true);
    }
});

test('business to retail preserves records, clears cart and revokes login; blocked remains blocked', async t => {
    let current;
    t.mock.method(User, 'findById', async () => current);
    t.mock.method(User, 'findOneAndUpdate', (filter, update, options) => {
        assert.equal(filter.type, 'Business');
        assert.equal(filter.status, current.status);
        assert.equal(update.$set.type, 'Retail');
        assert.equal(update.$set.status, current.status === 'Blocked' ? 'Blocked' : 'Active');
        assert.deepEqual(update.$set.cart, []);
        assert.equal(update.$inc.authVersion, 1);
        for (const field of ['businessDetails', 'phone', 'addresses', 'name']) assert.equal(update.$set[field], undefined);
        assert.equal(options.runValidators, true);
        return { select: async () => ({ _id: current._id, ...update.$set }) };
    });
    for (const status of ['Active', 'Pending', 'Blocked']) {
        current = new User({ phone: '9000000005', type: 'Business', status });
        const res = response();
        await controller.convertToRetail({ params: { id: String(current._id) } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.data.user.type, 'Retail');
    }
});

test('retail conversion rejects invalid, missing, deleted or retail customers and concurrent changes', async t => {
    let current;
    t.mock.method(User, 'findById', async () => current);
    const write = t.mock.method(User, 'findOneAndUpdate', () => ({ select: async () => null }));
    for (const [id, user, expected] of [
        ['bad', null, 400],
        [String(new mongoose.Types.ObjectId()), null, 404],
        [String(new mongoose.Types.ObjectId()), { type: 'Retail' }, 409],
        [String(new mongoose.Types.ObjectId()), { type: 'Business', deletedAt: new Date() }, 409],
    ]) {
        current = user;
        const res = response();
        await controller.convertToRetail({ params: { id } }, res);
        assert.equal(res.statusCode, expected);
    }
    assert.equal(write.mock.callCount(), 0);
    current = new User({ phone: '9000000005', type: 'Business' });
    const res = response();
    await controller.convertToRetail({ params: { id: String(current._id) } }, res);
    assert.equal(res.statusCode, 409);
});

test('business to retail endpoint is admin protected', () => {
    const router = require('../src/modules/User/route');
    const route = router.stack.find(layer => layer.route?.path === '/:id/convert-to-retail').route;
    assert.equal(route.methods.patch, true);
    assert.equal(route.stack[0].handle, protect);
});
