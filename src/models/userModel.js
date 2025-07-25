import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, },
        username: { type: String, unique: true },
        email: { type: String, unique: true },
        contactNo: { type: Number, unique: true },
        password: { type: String, required: true },
        profilePic: { type: String, default: null },
        bio: { type: String, maxlength: 160 },
        gender: { type: String, enum: ["male", "female"] },

        followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        followings: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

        posts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
        liked: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
        saved: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
        comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],

        joinedAt: { type: Date, default: Date.now },

        otp: { type: String },
        otpExpiry: { type: Date },

        // Privacy & Security
        isPrivate: { type: Boolean, default: false }, // If true, only approved followers can see posts
        blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        role: { type: String, enum: ["admin", "user"] },
        isAdmin: { type: Boolean, default: false },
        lastLogin: { type: Date, default: null },
        taggedPosts: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        }]
    },
    { timestamps: true }
);


// Pre-save middleware to ensure isAdmin is in sync with role
userSchema.pre('save', function (next) {
    this.isAdmin = this.role === 'admin';
    next();
});

//  JWT token create method
userSchema.methods.getJWT = async function () {
    const user = this;
    const token = jwt.sign({
        _id: user._id,
        role: user.role || 'user',
        isAdmin: user.role === 'admin'
    }, process.env.JWT_SECRET);
    return token;
};

//  Password validation method
userSchema.methods.validatePassword = async function (passwordInputByUser) {
    const user = this;
    return await bcrypt.compare(passwordInputByUser, user.password);
};

export default mongoose.model("User", userSchema);