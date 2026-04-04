const mongoose = require('mongoose');
const User = require('./src/modules/User/model');
const dotenv = require('dotenv');
dotenv.config();

async function checkDB() {
    try {
        const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/${process.env.DB_NAME}`;
        console.log('Connecting to:', uri.replace(process.env.MONGO_PASSWORD, '****'));
        await mongoose.connect(uri);
        console.log('Connected!');
        
        const count = await User.countDocuments();
        console.log('Total User Count:', count);
        
        const users = await User.find({});
        console.log('All Users:', JSON.stringify(users, null, 2));
        
        const retailUsers = await User.find({ type: 'Retail' });
        console.log('Retail Users:', JSON.stringify(retailUsers, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkDB();
