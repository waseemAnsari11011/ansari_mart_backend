const test = require('node:test');
const assert = require('node:assert/strict');
const { trendRange, buildTrendQuery, formatTrendResult, STATUSES } = require('../src/modules/Admin/orderTrends');

test('weekly range crosses year boundaries using IST, including zero days', () => {
    const range = trendRange('weekly', new Date('2026-01-01T19:00:00Z'));
    assert.equal(range.start.toISOString(), '2025-12-26T18:30:00.000Z');
    assert.equal(range.keys.length, 7);
    assert.equal(range.keys[0], '2025-12-27');
    assert.equal(range.keys[6], '2026-01-02');
});

test('monthly and three-month ranges honor leap years and month rollover', () => {
    const monthly = trendRange('monthly', new Date('2028-02-29T10:00:00Z'));
    assert.equal(monthly.keys.length, 29);
    assert.equal(monthly.start.toISOString(), '2028-01-31T18:30:00.000Z');
    const quarter = trendRange('quarterly', new Date('2026-01-02T10:00:00Z'));
    assert.equal(quarter.keys[0], '2025-11-01');
    assert.equal(quarter.keys.at(-1), '2026-01-02');
});

test('year-to-date buckets contain only months through today', () => {
    const range = trendRange('yearly', new Date('2026-10-24T12:00:00Z'));
    assert.equal(range.keys.length, 10);
    assert.equal(range.keys[0], '2026-01');
    assert.equal(range.keys.at(-1), '2026-10');
    assert.equal(range.format, '%Y-%m');
});

test('query maps B2C/B2B types, filters status before aggregation and groups by IST creation date', () => {
    for (const customerType of ['Retail', 'Business']) {
        const config = buildTrendQuery({ customerType }, new Date('2026-10-24T12:00:00Z'));
        const match = config.pipeline[0].$match;
        assert.equal(match.type, customerType);
        assert.equal(match.status, 'Delivered');
        assert.equal(match.createdAt.$gte.toISOString(), '2026-09-30T18:30:00.000Z');
        assert.equal(config.pipeline[1].$group._id.date.$dateToString.timezone, 'Asia/Kolkata');
        assert.equal(config.pipeline[1].$group._id.date.$dateToString.date, '$createdAt');
    }
    const all = buildTrendQuery({ customerType: 'all', status: 'all' });
    assert.equal(all.pipeline[0].$match.type, undefined);
    assert.equal(all.pipeline[0].$match.status, undefined);
    assert.deepEqual(all.statuses, STATUSES);
});

test('results fill missing dates/statuses with zero and total all selected series', () => {
    const config = buildTrendQuery({ period: 'weekly', status: 'all' }, new Date('2026-10-24T12:00:00Z'));
    const result = formatTrendResult(config, [
        { _id: { date: '2026-10-24', status: 'Delivered' }, count: 3 },
        { _id: { date: '2026-10-24', status: 'Cancelled' }, count: 2 },
    ]);
    assert.equal(result.points.length, 7);
    assert.equal(result.points[0].counts.Delivered, 0);
    assert.equal(result.points.at(-1).counts.Delivered, 3);
    assert.equal(result.points.at(-1).counts.Pending, 0);
    assert.equal(result.total, 5);
    assert.equal(formatTrendResult(config, []).total, 0);
});

test('invalid and object-valued filters are rejected', () => {
    for (const query of [{ period: 'daily' }, { customerType: 'B2B' }, { status: 'Lost' }, { status: { $ne: '' } }, { period: ['weekly'] }]) {
        assert.throws(() => buildTrendQuery(query));
    }
});

test('trend endpoint validates before querying, responds with zero-filled data, and handles database failure', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const path = require('node:path');
    const exports = {};
    let calls = 0;
    let fail = false;
    const Order = { aggregate: async () => {
        calls += 1;
        if (fail) throw new Error('Database unavailable');
        return [];
    } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/modules/Admin/trendController.js'), 'utf8'), {
        exports, require: name => name === '../Order/model' ? Order : require('../src/modules/Admin/orderTrends'),
    });
    const result = {};
    const res = { status: code => { result.status = code; return res; }, json: body => { result.body = body; return res; } };
    await exports.getOrderTrends({ query: { status: 'bad' } }, res);
    assert.equal(result.status, 400);
    assert.equal(calls, 0);
    result.status = 200;
    await exports.getOrderTrends({ query: { period: 'weekly' } }, res);
    assert.equal(result.status, 200);
    assert.equal(result.body.points.length, 7);
    assert.equal(result.body.total, 0);
    fail = true;
    await exports.getOrderTrends({ query: {} }, res);
    assert.equal(result.status, 500);
});

test('trend route is protected by admin authentication', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const route = fs.readFileSync(path.join(__dirname, '../src/modules/Admin/route.js'), 'utf8');
    assert.match(route, /router\.get\('\/order-trends', protect, getOrderTrends\)/);
});
