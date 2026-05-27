import mongoose from "mongoose";

const restrictCategorySchema = mongoose.Schema({
    restrictCategoryType: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("restrictCategory", restrictCategorySchema);