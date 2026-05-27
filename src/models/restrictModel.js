import mongoose from "mongoose";

const restrictSchema = mongoose.Schema({
    restrictCategoryId: { type: mongoose.Schema.Types.ObjectId, ref: "restrictCategory" },
    description: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    restrictedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model("Restrict", restrictSchema);