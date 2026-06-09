const admin = require("./firebase");

exports.sendPushNotification = async (message) => {
    return await admin.messaging().send(message);
};