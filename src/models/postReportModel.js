import mongoose from "mongoose";

const postReportSchema = mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    postReportCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "PostReportCategory", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model("PostReport", postReportSchema);
