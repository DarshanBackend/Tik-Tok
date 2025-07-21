import mongoose from "mongoose";

const audioCategorySchema = mongoose.Schema({
    audioCategory: {
        type: String
    }
}, { timestamps: true })

export default mongoose.model("AudioCategory", audioCategorySchema)