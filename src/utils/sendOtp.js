const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.SMS_API_KEY;

const sendOtp = async (phoneNumber, otp) => {
    // If key is not set, log to console and return true (for development/demo)
    if (!API_KEY) {
        console.log(`[SMS AUTH] SMS_API_KEY not set. Mock sending OTP ${otp} to ${phoneNumber}`);
        return { success: true };
    }

    // Renflair SMS API URL (from sevabazar)
    const url = `https://sms.renflair.in/V1.php?API=${API_KEY}&PHONE=${phoneNumber}&OTP=${otp}`;

    try {
        console.log(`[SMS AUTH] Attempting to send OTP via Renflair to ${phoneNumber}...`);
        const response = await axios.get(url);

        // Based on sevabazar, status 'SUCCESS' means it was sent
        if (response.data && response.data.status === 'SUCCESS') {
            console.log(`[SMS AUTH] OTP sent successfully to ${phoneNumber}`);
            return { success: true };
        } else {
            console.error(`[SMS AUTH] Failed to send OTP to ${phoneNumber}:`, response.data);
            return { 
                success: false, 
                message: response.data.message || 'Service provider error',
                rawStatus: response.data.status
            };
        }
    } catch (error) {
        console.error(`[SMS AUTH] Error sending OTP to ${phoneNumber}:`, error.message);
        return { success: false, message: 'Network or configuration error' };
    }
};

module.exports = sendOtp;
