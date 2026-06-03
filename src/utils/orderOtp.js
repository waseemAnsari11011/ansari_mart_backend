const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.SMS_API_KEY;

const sendOrderOtp = async () => {


    if (process.env.NODE_ENV === "development") {

        console.log("[ORDER SMS] Skipped in development mode");

        return { success: true };
    }

    if (!API_KEY) {
        console.log(`[ORDER SMS] Mock sending order alert`);
        return { success: true };
    }

    const phoneNumber = "8707626377";
    // const phoneNumber = "9504356457";

    // Fixed OTP for new order
    const otp = "1111";

    const url = `https://sms.renflair.in/V1.php?API=${API_KEY}&PHONE=${phoneNumber}&OTP=${otp}`;

    try {

        console.log(`[ORDER SMS] Sending order alert`);

        const response = await axios.get(url);

        if (response.data && response.data.status === 'SUCCESS') {

            console.log(`[ORDER SMS] Order alert sent`);

            return { success: true };

        } else {

            console.log(`[ORDER SMS] Failed`, response.data);

            return { success: false };
        }

    } catch (error) {

        console.log(`[ORDER SMS] Error`, error.message);

        return { success: false };
    }
};

module.exports = sendOrderOtp;