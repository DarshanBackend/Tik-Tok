import mongoose from "mongoose";

const reportSchema = mongoose.Schema({
    reportCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportCategory" },
    description: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model("Report", reportSchema);
