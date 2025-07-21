import mongoose from "mongoose";

const helpSupportSchema = mongoose.Schema({
    description: {
        type: Array,
        require: true
    }
}, { timestamps: true })

export default mongoose.model("HelpSupport", helpSupportSchema)