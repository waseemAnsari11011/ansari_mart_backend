require('dotenv').config();
const mongoose = require('mongoose');

const Admin = require('../src/modules/Admin/model');
const Category = require('../src/modules/Category/model');
const DeliveryZone = require('../src/modules/DeliveryZone/model');
const HelpSupport = require('../src/modules/HelpSupport/model');
const Notification = require('../src/modules/Notification/model');
const Order = require('../src/modules/Order/model');
const Product = require('../src/modules/Product/model');
const Setting = require('../src/modules/Setting/model');
const User = require('../src/modules/User/model');

const databaseName = String(process.env.DB_NAME || '').trim();
const shouldReset = process.argv.includes('--reset');

if (!/test$/i.test(databaseName)) {
    throw new Error(`Refusing to seed non-test database "${databaseName}"`);
}

const mongoUri = `mongodb+srv://${encodeURIComponent(process.env.MONGO_USERNAME)}:${encodeURIComponent(process.env.MONGO_PASSWORD)}@${process.env.MONGO_HOST}/${databaseName}?retryWrites=true&w=majority`;

const image = (seed, width = 800, height = 800) =>
    `https://picsum.photos/seed/ansarimart-${seed}/${width}/${height}`;

const categoryFixtures = [
    ['Daal', 'Everyday pulses and lentils'],
    ['Atta Besan & Sattu', 'Flours and wholesome staples'],
    ['Rice', 'Daily and premium rice'],
    ['Oil and Ghee', 'Cooking oils and traditional ghee'],
    ['Baby Care Female Hygiene & Personal Use', 'Personal care essentials'],
    ['Snacks & Beverages', 'Quick bites and refreshing drinks'],
    ['Cleaning & Household', 'Home cleaning and utility products'],
    ['Fruits & Vegetables', 'Fresh produce for every kitchen']
];

const productFixtures = [
    ['Daal', 'Toor Dal', 'Tata Sampann', 190, '1 kg'],
    ['Daal', 'Moong Dal', 'Fortune', 165, '1 kg'],
    ['Daal', 'Masoor Dal', 'Organic Tattva', 150, '1 kg'],
    ['Daal', 'Chana Dal', 'Nature Fresh', 135, '1 kg'],
    ['Atta Besan & Sattu', 'Whole Wheat Atta', 'Aashirvaad', 315, '5 kg'],
    ['Atta Besan & Sattu', 'Sharbati Atta', 'Fortune', 340, '5 kg'],
    ['Atta Besan & Sattu', 'Gram Flour Besan', 'Rajdhani', 115, '1 kg'],
    ['Atta Besan & Sattu', 'Roasted Chana Sattu', 'Farmley', 130, '1 kg'],
    ['Rice', 'India Gate Basmati Rice', 'India Gate', 690, '5 kg'],
    ['Rice', 'Everyday Sona Masoori Rice', 'Daawat', 410, '5 kg'],
    ['Rice', 'Brown Rice', '24 Mantra', 210, '1 kg'],
    ['Rice', 'Kolam Rice', 'Nature Fresh', 360, '5 kg'],
    ['Oil and Ghee', 'Sunflower Oil', 'Fortune', 155, '1 L'],
    ['Oil and Ghee', 'Mustard Oil', 'Dhara', 185, '1 L'],
    ['Oil and Ghee', 'Pure Cow Ghee', 'Amul', 680, '1 L'],
    ['Oil and Ghee', 'Rice Bran Oil', 'Saffola', 175, '1 L'],
    ['Baby Care Female Hygiene & Personal Use', 'Baby Lotion', 'Himalaya', 220, '400 ml'],
    ['Baby Care Female Hygiene & Personal Use', 'Sanitary Pads XL', 'Whisper', 190, '30 pads'],
    ['Baby Care Female Hygiene & Personal Use', 'Ponds Powder', 'Ponds', 117, '80 g'],
    ['Baby Care Female Hygiene & Personal Use', 'Dettol Shaving Cream', 'Dettol', 93, '78 g'],
    ['Snacks & Beverages', 'Classic Salted Chips', 'Lay’s', 40, '100 g'],
    ['Snacks & Beverages', 'Orange Drink', 'Real', 125, '1 L'],
    ['Snacks & Beverages', 'Masala Peanuts', 'Haldiram’s', 65, '200 g'],
    ['Snacks & Beverages', 'Instant Coffee', 'Nescafé', 180, '100 g'],
    ['Cleaning & Household', 'Floor Cleaner', 'Lizol', 230, '1 L'],
    ['Cleaning & Household', 'Dishwash Gel', 'Vim', 210, '750 ml'],
    ['Cleaning & Household', 'Laundry Detergent', 'Surf Excel', 270, '2 kg'],
    ['Cleaning & Household', 'Garbage Bags', 'Clean Mate', 120, '30 bags'],
    ['Fruits & Vegetables', 'Fresh Apples', 'Farm Fresh', 220, '1 kg'],
    ['Fruits & Vegetables', 'Bananas', 'Farm Fresh', 60, '1 dozen'],
    ['Fruits & Vegetables', 'Tomatoes', 'Farm Fresh', 45, '1 kg'],
    ['Fruits & Vegetables', 'Potatoes', 'Farm Fresh', 40, '1 kg']
];

const address = (name, phone, label = 'Home') => ({
    label,
    name,
    phone,
    address: label === 'Shop' ? 'Shop 12, Test Market Road' : 'Flat 202, Test Residency',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    landmark: 'Near Test Circle',
    latitude: 18.9388,
    longitude: 72.8354,
    isDefault: true
});

const run = async () => {
    await mongoose.connect(mongoUri);
    if (mongoose.connection.name !== databaseName) {
        throw new Error(`Connected to unexpected database "${mongoose.connection.name}"`);
    }

    const existingDocuments = await Promise.all([
        Admin.countDocuments(), Category.countDocuments(), User.countDocuments(),
        Product.countDocuments(), Order.countDocuments()
    ]);
    if (existingDocuments.some(Boolean) && !shouldReset) {
        throw new Error('Test data already exists. Re-run with --reset to replace it.');
    }

    await Promise.all([
        Admin.deleteMany({}), Category.deleteMany({}), DeliveryZone.deleteMany({}),
        HelpSupport.deleteMany({}), Notification.deleteMany({}), Order.deleteMany({}),
        Product.deleteMany({}), Setting.deleteMany({}), User.deleteMany({})
    ]);

    const admin = await Admin.create({
        name: 'Test Administrator',
        email: 'admin@test.ansarimart.local',
        password: 'Test@123',
        phone: '9000000000'
    });

    const categories = await Category.insertMany(categoryFixtures.map(([name, description], index) => ({
        name,
        description,
        image: image(`category-${index}`, 500, 350),
        status: index === categoryFixtures.length - 1 ? 'Inactive' : 'Active'
    })));
    const categoryByName = Object.fromEntries(categories.map(category => [category.name, category]));

    const products = await Product.insertMany(productFixtures.map(([category, name, brand, mrp, unit], index) => ({
        name,
        description: `${brand} ${name} dummy product for application testing.`,
        brand,
        mrp,
        category: categoryByName[category]._id,
        admin: admin._id,
        images: [image(`product-${index}`), image(`product-${index}-detail`)],
        retailStatus: index === 30 ? 'Inactive' : 'Active',
        businessStatus: index === 29 ? 'Inactive' : 'Active',
        retailPricing: [
            { label: unit, minQty: 1, maxQty: 9, price: Math.round(mrp * 0.9), unit, stock: index === 0 ? 0 : index === 1 ? 3 : 50 + index },
            { label: `2 × ${unit}`, minQty: 1, maxQty: 5, price: Math.round(mrp * 1.72), unit, stock: 20 + index }
        ],
        businessPricing: [
            { label: `Case of 12 (${unit})`, minQty: 1, maxQty: 20, price: Math.round(mrp * 9.6), unit: 'Case', stock: index === 2 ? 2 : 30 + index },
            { label: `Case of 24 (${unit})`, minQty: 1, maxQty: 10, price: Math.round(mrp * 18), unit: 'Case', stock: 15 + index }
        ]
    })));

    const users = await User.create([
        { name: 'Retail Test User', phone: '9000000001', type: 'Retail', status: 'Active', addresses: [address('Retail Test User', '9000000001')] },
        { name: 'Second Retail User', phone: '9000000002', type: 'Retail', status: 'Active', addresses: [address('Second Retail User', '9000000002', 'Work')] },
        { name: 'Blocked Retail User', phone: '9000000003', type: 'Retail', status: 'Blocked', addresses: [address('Blocked Retail User', '9000000003')] },
        {
            name: 'Approved Business User', phone: '9000000011', password: 'Test@123',
            type: 'Business', status: 'Active', addresses: [address('Approved Business User', '9000000011', 'Shop')],
            businessDetails: { shopName: 'Test Wholesale Store', businessType: 'Grocery', gstNo: '27ABCDE1234F1Z5', panNo: 'ABCDE1234F', businessAddress: 'Shop 12, Test Market Road, Mumbai', latitude: 18.9388, longitude: 72.8354, verificationStatus: 'Approved', shopPhoto: image('shop-approved') }
        },
        {
            name: 'Pending Business User', phone: '9000000012', password: 'Test@123',
            type: 'Business', status: 'Pending', addresses: [address('Pending Business User', '9000000012', 'Shop')],
            businessDetails: { shopName: 'Pending Test Store', businessType: 'General Store', gstNo: '27ABCDE5678G1Z2', panNo: 'ABCDE5678G', businessAddress: 'Test Bazaar, Mumbai', verificationStatus: 'Pending', shopPhoto: image('shop-pending') }
        },
        {
            name: 'Rejected Business User', phone: '9000000013', password: 'Test@123',
            type: 'Business', status: 'Active', addresses: [address('Rejected Business User', '9000000013', 'Shop')],
            businessDetails: { shopName: 'Rejected Test Store', businessType: 'Retailer', verificationStatus: 'Rejected' }
        }
    ]);

    users[0].cart = [
        { product: products[4]._id, quantity: 2, tierIndex: 0, isWholesale: false },
        { product: products[16]._id, quantity: 1, tierIndex: 1, isWholesale: false }
    ];
    users[3].cart = [
        { product: products[8]._id, quantity: 2, tierIndex: 0, isWholesale: true }
    ];
    await Promise.all([users[0].save(), users[3].save()]);

    const statuses = ['Pending', 'Packing', 'On the way', 'Delivered', 'Cancelled'];
    const orderFixtures = [];
    for (let index = 0; index < 12; index += 1) {
        const isBusiness = index >= 7;
        const user = isBusiness ? users[3] : users[index % 2];
        const productA = products[(index * 2) % products.length];
        const productB = products[(index * 2 + 1) % products.length];
        const pricingField = isBusiness ? 'businessPricing' : 'retailPricing';
        const firstTier = productA[pricingField][0];
        const secondTier = productB[pricingField][1];
        const status = statuses[index % statuses.length];
        const deliveryFee = isBusiness ? 100 : 40;
        const items = [
            { product: productA._id, name: productA.name, qty: 1, image: productA.images[0], price: firstTier.price, unit: firstTier.unit, tierLabel: firstTier.label, tierIndex: 0 },
            { product: productB._id, name: productB.name, qty: 2, image: productB.images[0], price: secondTier.price, unit: secondTier.unit, tierLabel: secondTier.label, tierIndex: 1 }
        ];
        const createdAt = new Date(Date.now() - index * 86400000);
        orderFixtures.push({
            admin: user._id,
            orderItems: items,
            shippingAddress: user.addresses[0].toObject(),
            paymentMethod: index % 3 === 0 ? 'ONLINE' : 'Cash',
            totalPrice: items.reduce((sum, item) => sum + item.price * item.qty, deliveryFee),
            deliveryFee,
            status,
            type: isBusiness ? 'Business' : 'Retail',
            isPaid: index % 3 === 0,
            paidAt: index % 3 === 0 ? createdAt : undefined,
            isDelivered: status === 'Delivered',
            deliveredAt: status === 'Delivered' ? new Date(createdAt.getTime() + 7200000) : undefined,
            createdAt,
            updatedAt: createdAt
        });
    }
    const orders = await Order.insertMany(orderFixtures);

    await Setting.create({
        banners: [
            { title: 'Test Grocery Sale', image: image('banner-sale', 1200, 450), status: 'ACTIVE' },
            { title: 'Wholesale Test Deals', image: image('banner-wholesale', 1200, 450), status: 'ACTIVE' },
            { title: 'Inactive Banner', image: image('banner-inactive', 1200, 450), status: 'INACTIVE' }
        ],
        logistics: {
            Retail: { mov: 499, deliveryCharge: 40 },
            Business: { mov: 5000, deliveryCharge: 100 }
        },
        units: ['Unit', 'kg', 'g', 'L', 'ml', 'Pack', 'Case', 'Dozen']
    });

    await DeliveryZone.create({
        name: 'Mumbai Test Delivery Area',
        area: {
            type: 'Polygon',
            coordinates: [[[72.75, 18.85], [72.98, 18.85], [72.98, 19.25], [72.75, 19.25], [72.75, 18.85]]]
        },
        isActive: true
    });
    await HelpSupport.create({ mobile: '9000000099', email: 'support@test.ansarimart.local' });
    await Notification.insertMany([
        { title: 'Welcome to Test Mode', body: 'This is seeded notification data.', recipientCount: users.length },
        { title: 'Low Stock Test', body: `${products[1].name} has limited stock.`, recipientCount: 1, productId: products[1]._id },
        { title: 'New Product Test', body: `${products[16].name} is now available.`, recipientCount: users.length, productId: products[16]._id }
    ]);

    console.log(JSON.stringify({
        database: mongoose.connection.name,
        seeded: {
            admins: 1, categories: categories.length, products: products.length,
            users: users.length, orders: orders.length, settings: 1,
            deliveryZones: 1, helpSupports: 1, notifications: 3
        },
        testCredentials: {
            admin: { email: 'admin@test.ansarimart.local', password: 'Test@123' },
            retail: { phone: '9000000001', otp: '1234' },
            business: { phone: '9000000011', otp: '1234' }
        }
    }, null, 2));
};

run()
    .catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
