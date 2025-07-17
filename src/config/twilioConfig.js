export const twilioConfig = {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,

    validateConfig() {
        const missingFields = [];
        if (!this.accountSid) missingFields.push('TWILIO_ACCOUNT_SID');
        if (!this.authToken) missingFields.push('TWILIO_AUTH_TOKEN');
        if (!this.phoneNumber) missingFields.push('TWILIO_PHONE_NUMBER');

        if (missingFields.length > 0) {
            throw new Error(`Missing Twilio configuration: ${missingFields.join(', ')}`);
        }

        return true;
    },

    getClient() {
        this.validateConfig();
        const twilio = require('twilio');
        return twilio(this.accountSid, this.authToken);
    }
};

