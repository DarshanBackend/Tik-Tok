import mongoose from "mongoose";

const termsOfServicesSchema = mongoose.Schema({
    description: {
        type: Array,
        require: true
    }
}, { timestamps: true })

export default mongoose.model("TermsOfServices", termsOfServicesSchema)