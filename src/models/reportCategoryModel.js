import mongoose from "mongoose";

const reportCategorySchema = mongoose.Schema({
    reportCategoryType: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("ReportCategory", reportCategorySchema);
