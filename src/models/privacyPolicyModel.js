import mongoose from "mongoose";

const privacyPolicySchema = mongoose.Schema({
    description: {
        type: Array,
        require: true
    }
}, { timestamps: true })

export default mongoose.model("PrivacyPolicy", privacyPolicySchema)