import User from "../models/userModel.js";
import { generateOTP, phoneNoOtp } from "./loginController.js";
import { ThrowError } from "../utils/ErrorUtils.js"
import mongoose from "mongoose"
import bcrypt from "bcryptjs";
import fs from 'fs';
import path from "path";
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse, sendForbiddenResponse, sendCreatedResponse, sendUnauthorizedResponse, sendNotFoundResponse } from '../utils/ResponseUtils.js';
import { getReceiverSocketId, io } from "../socket/socket.js";
import Post from "../models/postModel.js"
import Comment from "../models/commentModel.js"
import { deleteFromS3 } from "../utils/uploadS3.js";


export const register = async (req, res) => {
    try {
        const { contactNo, mobileNo, email, password, name, role, profilePic } = req.body;

        const finalContactNo = contactNo || mobileNo;

        if (!finalContactNo && !email) {
            return sendBadRequestResponse(res, "Mobile number or Email is required.");
        }

        // Check for contactNo uniqueness if provided
        if (finalContactNo) {
            const userByContact = await User.findOne({ contactNo: finalContactNo });
            if (userByContact) {
                return sendBadRequestResponse(res, "Mobile number already taken");
            }
        }

        // Check for email uniqueness if provided
        if (email) {
            const userByEmail = await User.findOne({ email });
            if (userByEmail) {
                return sendBadRequestResponse(res, "Email already in use");
            }
        }

        let hashedPass = null;
        if (password) {
            hashedPass = await bcrypt.hash(password, 10);
        }

        let otp = null;
        let otpExpiry = null;

        if (finalContactNo) {
            otp = generateOTP();
            otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
            await phoneNoOtp(finalContactNo, otp);
        }

        const data = await User.create({
            name,
            email,
            contactNo: finalContactNo,
            password: hashedPass,
            profilePic: profilePic || null,
            role: role || 'user',
            otp,
            otpExpiry
        });

        if (finalContactNo) {
            return sendCreatedResponse(res, "OTP sent to mobile number. Please verify to complete registration.", { contactNo: finalContactNo });
        }

        const token = await data.getJWT();
        if (!token) {
            return sendErrorResponse(res, 500, "Failed to generate token");
        }

        return sendCreatedResponse(res, "Account created successfully", { data, token: token });
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const editProfile = async (req, res) => {
    try {
        const userId = req.params.id;
        const {
            name,
            username,
            email,
            bio,
            gender,
            isPrivate,
        } = req.body;

        if (!req.user || (req.user._id.toString() !== userId && req.user.role !== 'admin')) {
            return sendForbiddenResponse(res, "Access denied. You can only update your own profile.");
        }

        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return sendErrorResponse(res, 404, "User not found");
        }

        // Check for unique username
        if (username && username !== existingUser.username) {
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return sendErrorResponse(res, 400, "Username already exists");
            }
        }

        // Check for unique email
        if (email && email !== existingUser.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                return sendErrorResponse(res, 400, "Email already exists");
            }
        }

        // Handle image upload
        if (req.file) {
            if (existingUser.profilePic && existingUser.profilePic.includes('.amazonaws.com/')) {
                const oldKey = existingUser.profilePic.split('.amazonaws.com/')[1];
                if (oldKey) deleteFromS3(oldKey).catch(err => console.error("Failed to delete old profile pic from S3:", err));
            }
            existingUser.profilePic = req.file.path;
        }

        // Update allowed fields
        if (name) existingUser.name = name;
        if (username) existingUser.username = username;
        if (email) existingUser.email = email;
        if (bio) existingUser.bio = bio;
        if (gender) existingUser.gender = gender;
        if (isPrivate !== undefined) existingUser.isPrivate = isPrivate;

        await existingUser.save();
        const userResponse = existingUser.toObject();
        delete userResponse.password;
        return sendSuccessResponse(res, "User updated successfully", userResponse);

    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const getAllUsers = async (req, res) => {
    try {
        // Check if user is authenticated and is admin
        if (!req.user) {
            return sendUnauthorizedResponse(res, "Authentication required");
        }

        if (!req.user.isAdmin) {
            return sendForbiddenResponse(res, "Access denied. Only admins can view all users.");
        }

        // Find all users with role 'user'
        const users = await User.find({ role: 'user' }).select('-password');

        // Check if any users were found
        if (!users || users.length === 0) {
            return sendSuccessResponse(res, "No users found", []);
        }

        const formattedUsers = users.map(user => ({
            ...user._doc,
            profilePic: user.profilePic || "https://avatar.iran.liara.run/public"
        }));

        // Send a success response with the fetched users
        return sendSuccessResponse(res, "Users fetched successfully", formattedUsers);

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
};

export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists and has proper role
        if (!req.user) {
            return sendUnauthorizedResponse(res, "Authentication required");
        }

        // Check if user is admin or accessing their own profile
        const isAdmin = req.user.role === 'admin';
        if (!isAdmin && req.user._id.toString() !== id) {
            return sendForbiddenResponse(res, "Access denied. You can only view your own profile.");
        }

        // Use findById for more robust lookup
        const user = await User.findById(id);
        if (!user) {
            return sendErrorResponse(res, 404, "User not found", []);
        }

        // Prepare user response (exclude password)
        const userResponse = user.toObject();
        delete userResponse.password;

        if (!userResponse.profilePic) {
            userResponse.profilePic = "https://avatar.iran.liara.run/public";
        }

        return sendSuccessResponse(res, "User retrieved successfully", userResponse);
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
};

export const editUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const {
            name,
            username,
            email,
            bio,
            gender,
            isPrivate,
        } = req.body;

        if (!req.user || (req.user._id.toString() !== userId && req.user.role !== 'admin')) {
            return sendForbiddenResponse(res, "Access denied. You can only update your own profile.");
        }

        const existingUser = await User.findById(userId);
        if (!existingUser) {
            return sendErrorResponse(res, 404, "User not found");
        }

        // Handle image upload
        if (req.file) {
            if (existingUser.profilePic && existingUser.profilePic.includes('.amazonaws.com/')) {
                const oldKey = existingUser.profilePic.split('.amazonaws.com/')[1];
                if (oldKey) deleteFromS3(oldKey).catch(err => console.error("Failed to delete old profile pic from S3:", err));
            }
            existingUser.profilePic = req.file.path;
        }

        // Update allowed fields
        if (name) existingUser.name = name;
        if (username) existingUser.username = username;
        if (email) existingUser.email = email;
        if (bio) existingUser.bio = bio;
        if (gender) existingUser.gender = gender;
        if (isPrivate !== undefined) existingUser.isPrivate = isPrivate;

        await existingUser.save();
        const userResponse = existingUser.toObject();
        delete userResponse.password;
        return sendSuccessResponse(res, "User updated successfully", userResponse);

    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const deleteUser = async (req, res) => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            return sendBadRequestResponse(res, "User ID is required");
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendErrorResponse(res, 404, "User not found");
        }

        // Delete profile pic from S3
        if (user.profilePic && user.profilePic.includes('.amazonaws.com/')) {
            const key = user.profilePic.split('.amazonaws.com/')[1];
            if (key) deleteFromS3(key).catch(err => console.error("Failed to delete user profile pic from S3:", err));
        }

        // 1. Delete user's posts
        await Post.deleteMany({ user: userId });

        // 2. Delete comments by user
        await Comment.deleteMany({ user: userId });

        // 3. Remove likes and saved references from all posts
        await Post.updateMany(
            { likes: userId },
            { $pull: { likes: userId } }
        );
        await Post.updateMany(
            { saved: userId },
            { $pull: { saved: userId } }
        );
        await Post.updateMany(
            { taggedFriends: userId },
            { $pull: { taggedFriends: userId } }
        );
        await Comment.updateMany(
            { likeComment: userId },
            { $pull: { likeComment: userId } }
        )

        // 7. Remove user from other users' followers and followings
        await User.updateMany(
            { followers: userId },
            { $pull: { followers: userId } }
        );
        await User.updateMany(
            { followings: userId },
            { $pull: { followings: userId } }
        );

        // 8. (Optional) Remove from blockedUsers if used
        await User.updateMany(
            { blockedUsers: userId },
            { $pull: { blockedUsers: userId } }
        );

        // 9. Finally, delete the user
        await User.findByIdAndDelete(userId);

        return sendSuccessResponse(res, "User and all associated data deleted successfully");
    } catch (error) {
        return sendErrorResponse(res, 500, "Something went wrong while deleting the user");
    }
};


export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return sendBadRequestResponse(res, "Query is required")
        }

        const users = await User.find({
            _id: { $ne: req.user._id },
            $or: [
                { username: { $regex: `^${query}`, $options: "i" } },
                { name: { $regex: `${query}`, $options: "i" } },
            ],
            role: { $ne: 'admin' },
        }).select("username name profilePic _id");

        if (users.length === 0) {
            return sendNotFoundResponse(res, "No user found.")
        }

        const formattedUsers = users.map(user => ({
            ...user._doc,
            profilePic: user.profilePic || "https://avatar.iran.liara.run/public"
        }));

        return sendSuccessResponse(res, "user fetched successfully...", formattedUsers)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
};

export const suggestedUsers = async (req, res) => {
    try {
        const currentUserId = req.user?._id;

        const suggestedUsers = await User.find({
            _id: { $ne: currentUserId },
            role: { $ne: 'admin' } // Exclude admins
        }).select("-password");

        if (!suggestedUsers) {
            return sendBadRequestResponse(res, "Currently do not have any users")
        }
        const formattedSuggested = suggestedUsers.map(user => ({
            ...user._doc,
            profilePic: user.profilePic || "https://avatar.iran.liara.run/public"
        }));

        return sendSuccessResponse(res, "Suggested users fetched successfully...", formattedSuggested)
    } catch (error) {
        console.log(error);
    }
};

export const followOrUnfollow = async (req, res) => {
    try {
        const userId = req.user._id;
        const followingUserId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(followingUserId)) {
            return sendBadRequestResponse(res, "Invalid FollowingUserId")
        }

        if (userId.toString() === followingUserId.toString()) {
            return sendBadRequestResponse(res, "You can't follow and unfollow yourself")
        }

        const user = await User.findById(userId);
        const followingUser = await User.findById(followingUserId);

        if (!user || !followingUser) {
            return sendBadRequestResponse(res, "User not found")
        }

        const isFollowing = user.followings.includes(followingUserId);

        if (isFollowing) {
            // Unfollow logic
            await Promise.all([
                User.findByIdAndUpdate(
                    userId,
                    { $pull: { followings: followingUserId } },
                    { new: true }
                ),
                User.findByIdAndUpdate(
                    followingUserId,
                    { $pull: { followers: userId } },
                    { new: true }
                ),
            ]);

            const newUserData = await User.findById(userId);
            const newFollowingUser = await User.findById(followingUserId);
            return res.status(200).json({
                message: "Unfollowing",
                user: newUserData,
                followingUser: newFollowingUser,
                success: true,
            });
        } else {
            // Follow logic
            await Promise.all([
                User.findByIdAndUpdate(
                    userId,
                    { $push: { followings: followingUserId } },
                    { new: true }
                ),
                User.findByIdAndUpdate(
                    followingUserId,
                    { $push: { followers: userId } },
                    { new: true }
                ),
            ]);

            const newUserData = await User.findById(userId);
            const newFollowingUser = await User.findById(followingUserId);

            const notification = {
                type: "follow",
                userId: userId,
                userDetails: user,
                message: `started following you.`,
            };

            const receiverSocketId = getReceiverSocketId(followingUserId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit("notification", notification);
            }

            return res.status(200).json({
                message: "Following",
                user: newUserData,
                followingUser: newFollowingUser,
                success: true,
            });
        }
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
};
