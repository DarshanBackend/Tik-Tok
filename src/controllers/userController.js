import User from "../models/userModel.js";
import { ThrowError } from "../utils/ErrorUtils.js"
import mongoose from "mongoose"
import bcrypt from "bcryptjs";
import fs from 'fs';
import path from "path";
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse, sendForbiddenResponse, sendCreatedResponse, sendUnauthorizedResponse } from '../utils/ResponseUtils.js';



export const register = async (req, res) => {
    try {
        const { contactNo, name, email, password } = req.body;

        // Check if the email or contactNo already exists
        const userByEmail = await User.findOne({ email });
        const userBycontactNo = await User.findOne({ contactNo });

        if (userByEmail) {
            return res.status(400).json({
                message: "Email already in use",
                success: false,
            });
        }

        if (userBycontactNo) {
            return res.status(400).json({
                message: "ContactNo already taken",
                success: false,
            });
        }

        const hashedPass = await bcrypt.hash(password, 10);

        await User.create({
            name,
            email,
            contactNo,
            password: hashedPass,
        });

        return res.status(201).json({
            message: "Account created successfully",
            success: true,
        });
    } catch (error) {
        console.log(error);
    }
};

export const editProfile = async (req, res) => {
    try {
        const userId = req.id;
        const {
            name,
            username,
            email,
            bio,
            gender,
            isPrivate,
        } = req.body;

        if (!req.user || req.user._id.toString() !== userId) {
            if (req.file) {
                const filePath = path.resolve(req.file.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return sendForbiddenResponse(res, "Access denied. You can only update your own profile.");
        }

        const existingUser = await User.findById(userId);
        if (!existingUser) {
            if (req.file) {
                const filePath = path.resolve(req.file.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
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
            const newImagePath = `/public/profilePic/${path.basename(req.file.path)}`;
            if (existingUser.profilePic && fs.existsSync(path.join(process.cwd(), existingUser.profilePic))) {
                fs.unlinkSync(path.join(process.cwd(), existingUser.profilePic));
            }
            existingUser.profilePic = newImagePath;
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
        if (req.file) {
            const filePath = path.resolve(req.file.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        return sendErrorResponse(res, 500, error.message);
    }
};

// export const registerUser = async (req, res) => {
//     try {
//         const { name, gender, email, contactNo, password } = req.body;

//         const existing = await Register.findOne({ email });
//         if (existing) {
//             existing.otp = generateOTP()
//             existing.save()
//             phoneNoOtp(existing.contactNo, existing.otp)
//             return sendBadRequestResponse(res, "contactNo already registered");
//         }

//         const otp = generateOTP();
//         const newUser = await Register.create({
//             contactNo,
//             role: 'user',
//             isAdmin: false,
//             otp,
//             otpExpiry: new Date(Date.now() + 5 * 60 * 1000)
//         });
//         phoneNoOtp(contactNo, otp)

//         return sendCreatedResponse(res, "User registered. OTP sent.", { data: newUser });
//     } catch (error) {
//         return ThrowError(res, 500, error.message);
//     }
// };


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

        // Send a success response with the fetched users
        return sendSuccessResponse(res, "Users fetched successfully", users);

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
            return sendErrorResponse(res, 404, "User not found");
        }

        // Prepare user response (exclude password)
        const userResponse = user.toObject();
        delete userResponse.password;

        return sendSuccessResponse(res, "User retrieved successfully", userResponse);
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
};

export const editUser = async (req, res) => {
    try {
        const userId = req.id;
        const {
            name,
            username,
            email,
            bio,
            gender,
            isPrivate,
        } = req.body;

        if (!req.user || req.user._id.toString() !== userId) {
            if (req.file) {
                const filePath = path.resolve(req.file.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return sendForbiddenResponse(res, "Access denied. You can only update your own profile.");
        }

        const existingUser = await User.findById(userId);
        if (!existingUser) {
            if (req.file) {
                const filePath = path.resolve(req.file.path);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            return sendErrorResponse(res, 404, "User not found");
        }

        // Handle image upload
        if (req.file) {
            const newImagePath = `/public/profilePic/${path.basename(req.file.path)}`;
            if (existingUser.profilePic && fs.existsSync(path.join(process.cwd(), existingUser.profilePic))) {
                fs.unlinkSync(path.join(process.cwd(), existingUser.profilePic));
            }
            existingUser.profilePic = newImagePath;
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
        console.error("Error in editUser:", error);
        return res.status(500).json({
            message: "Something went wrong while updating the profile",
            success: false,
            error: error.message,
        });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required", success: false });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        // 1. Delete user's posts
        await Post.deleteMany({ author: userId });

        // 2. Delete comments by user
        await Comment.deleteMany({ author: userId });

        // 3. Remove likes and saved references from all posts
        await Post.updateMany(
            { likes: userId },
            { $pull: { likes: userId } }
        );
        await Post.updateMany(
            { saved: userId },
            { $pull: { saved: userId } }
        );

        // 4. Delete messages sent or received
        await Message.deleteMany({ $or: [{ senderId: userId }, { receiverId: userId }] });

        // 5. Delete conversations where user is a participant
        await Conversation.deleteMany({ participants: userId });

        // 6. Delete reports made by the user
        await Report.deleteMany({ user: userId });

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

        return res.status(200).json({
            message: "User and all associated data deleted successfully",
            success: true,
        });
    } catch (error) {
        console.log("Error deleting user:", error);
        return res.status(500).json({
            message: "Something went wrong while deleting the user",
            success: false,
        });
    }
};
