const STATUSES = ['Pending', 'Packing', 'On the way', 'Delivered', 'Cancelled'];
const IST_OFFSET = 330 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// Shift into IST calendar coordinates; UTC accessors avoid the host's timezone.
function trendRange(period, now = new Date()) {
    const local = new Date(now.getTime() + IST_OFFSET);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth();
    const day = local.getUTCDate();
    const today = Date.UTC(year, month, day);
    let start;
    let monthly = false;
    switch (period) {
        case 'weekly': start = today - 6 * DAY; break;
        case 'monthly': start = Date.UTC(year, month, 1); break;
        case 'quarterly': start = Date.UTC(year, month - 2, 1); break;
        case 'yearly': start = Date.UTC(year, 0, 1); monthly = true; break;
        default: throw new Error('Invalid period');
    }
    const keys = [];
    for (let cursor = start; cursor <= today;) {
        const date = new Date(cursor);
        keys.push(date.toISOString().slice(0, monthly ? 7 : 10));
        cursor = monthly
            ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
            : cursor + DAY;
    }
    return {
        start: new Date(start - IST_OFFSET),
        end: new Date(now),
        format: monthly ? '%Y-%m' : '%Y-%m-%d',
        granularity: monthly ? 'month' : 'day',
        keys
    };
}

function buildTrendQuery(query, now) {
    const { period = 'monthly', customerType = 'all', status = 'Delivered' } = query;
    if (!['all', 'Retail', 'Business'].includes(customerType)) throw new Error('Invalid customer type');
    if (status !== 'all' && !STATUSES.includes(status)) throw new Error('Invalid order status');
    const range = trendRange(period, now);
    const match = { createdAt: { $gte: range.start, $lte: range.end } };
    if (customerType !== 'all') match.type = customerType;
    if (status !== 'all') match.status = status;
    return {
        period, customerType, status, range,
        statuses: status === 'all' ? STATUSES : [status],
        pipeline: [
            { $match: match },
            { $group: {
                _id: {
                    date: { $dateToString: { date: '$createdAt', format: range.format, timezone: 'Asia/Kolkata' } },
                    status: '$status'
                },
                count: { $sum: 1 }
            } },
            { $sort: { '_id.date': 1 } }
        ]
    };
}

function formatTrendResult(config, rows) {
    const { period, customerType, status, range, statuses } = config;
    const counts = new Map(rows.map(row => [`${row._id.date}|${row._id.status}`, row.count]));
    const points = range.keys.map(date => ({
        date,
        counts: Object.fromEntries(statuses.map(name => [name, counts.get(`${date}|${name}`) || 0]))
    }));
    return {
        period, customerType, status, statuses, points,
        timezone: 'Asia/Kolkata',
        granularity: range.granularity,
        startDate: range.start.toISOString(), endDate: range.end.toISOString(),
        total: points.reduce((sum, point) => sum + Object.values(point.counts).reduce((a, b) => a + b, 0), 0)
    };
}

module.exports = { STATUSES, trendRange, buildTrendQuery, formatTrendResult };
