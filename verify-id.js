const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function deepSearch() {
    try {
        const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/${process.env.DB_NAME}`;
        await mongoose.connect(uri);
        console.log('Connected to DB:', process.env.DB_NAME);
        
        const targetId = '69b7d28bba94aa0ed1beaf99';
        const targetObjectId = new mongoose.Types.ObjectId(targetId);
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Total Collections:', collections.length);
        
        for (const col of collections) {
            const count = await mongoose.connection.db.collection(col.name).countDocuments({ _id: targetObjectId });
            if (count > 0) {
                console.log(`FOUND in collection: "${col.name}"`);
                const doc = await mongoose.connection.db.collection(col.name).findOne({ _id: targetObjectId });
                console.log('Document:', JSON.stringify(doc, null, 2));
            }
        }
        
        const allUsers = await mongoose.connection.db.collection('users').find({}).toArray();
        console.log('Total users in "users" collection:', allUsers.length);
        if (allUsers.length > 0) {
            console.log('Sample user ID from "users":', allUsers[0]._id);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

deepSearch();
