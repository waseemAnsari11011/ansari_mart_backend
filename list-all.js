const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function listUsers() {
    try {
        const uri = `mongodb+srv://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}/${process.env.DB_NAME}`;
        await mongoose.connect(uri);
        
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const col of collections) {
            const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
            if (docs.length > 0) {
                console.log(`--- Collection: ${col.name} (${docs.length} docs) ---`);
                docs.forEach(d => {
                    console.log(`ID: ${d._id} | Phone: ${d.phone} | Name: ${d.name || 'N/A'} | Type: ${d.type}`);
                });
            }
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

listUsers();
