import mongoose from "mongoose";

const postReportCategorySchema = mongoose.Schema({
    postReportCategoryType: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("PostReportCategory", postReportCategorySchema);
