import User from "../models/userModel.js";
import { ThrowError } from "../utils/ErrorUtils.js"
import bcrypt from "bcryptjs";
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse, sendUnauthorizedResponse } from '../utils/ResponseUtils.js';
import nodemailer from "nodemailer"
import twilio from 'twilio';



export const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

export const phoneNoOtp = async (contactNo, otp) => {
    let formattedContactNo = contactNo.toString().replace(/\D/g, '');
    if (formattedContactNo.length === 10) {
        formattedContactNo = `+91${formattedContactNo}`;
    } else if (formattedContactNo.length === 12 && formattedContactNo.startsWith('91')) {
        formattedContactNo = `+${formattedContactNo}`;
    } else {
        return ThrowError(res, 400, "Invalid contactNo format. Please provide a valid 10-digit Indian contactNo.");
    }
    // Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !fromPhone) {
    }
    const client = twilio(accountSid, authToken);
    try {
        await client.messages.create({
            body: `Your verification code is: ${otp}. Valid for 5 minutes.`,
            to: formattedContactNo,
            from: fromPhone
        });
    } catch (twilioError) {
        console.log(`SMS sending failed: ${twilioError.message}`);
    }
}

// Utility to send OTP to email
export const sendOtpEmail = async (email, otp) => {

    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: process.env.MY_GMAIL,
            pass: process.env.MY_PASSWORD ? process.env.MY_PASSWORD.trim() : "",
        },
    });

    console.log("SMTP Debug Check:", {
        user: process.env.MY_GMAIL,
        hasPassword: !!process.env.MY_PASSWORD,
        passwordLength: process.env.MY_PASSWORD ? process.env.MY_PASSWORD.length : 0
    });

    const mailOptions = {
        from: `"TikTok Verification" <${process.env.MY_GMAIL}>`,
        to: email,
        subject: "Verification OTP",
        text: `Your OTP for verification is: ${otp}. It is valid for 10 minutes.`,
    };

    try {
        console.log(`Attempting to send OTP to ${email}...`);
        await transporter.sendMail(mailOptions);
        console.log(`OTP sent successfully to ${email}`);
    } catch (error) {
        console.error("Nodemailer Error Details:", {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            stack: error.stack
        });
        throw new Error("Failed to send verification email. Please check SMTP credentials.");
    }
}

export const userLogin = async (req, res) => {
    try {
        const { email, password, contactNo } = req.body;

        // 1. Contact Number Login (OTP)
        if (contactNo && !email && !password) {
            // Check if user exists with this contactNo
            const user = await User.findOne({ contactNo });
            if (!user) {
                return sendErrorResponse(res, 404, "User not found with this contact number");
            }

            // Generate OTP (e.g., 6 digit random number)
            const otp = generateOTP();

            // Set OTP and expiry (e.g., 5 minutes from now)
            user.otp = otp;
            user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
            await user.save();

            // Send OTP to contactNo
            await phoneNoOtp(contactNo, otp);

            return sendSuccessResponse(res, "OTP sent to contact number", { contactNo });
        }

        // 2. Email & Password Login
        if (!email || !password) {
            return sendBadRequestResponse(res, "Email and password are required");
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return sendErrorResponse(res, 404, "User not found");
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return sendUnauthorizedResponse(res, "Invalid password");
        }

        // Always update lastLogin on successful login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = await user.getJWT();
        if (!token) {
            return sendErrorResponse(res, 500, "Failed to generate token");
        }

        // Return user data with role and isAdmin status
        return sendSuccessResponse(res, "Login successful", {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role || 'user',
            isAdmin: user.role === 'admin',
            lastLogin: user.lastLogin,
            token: token
        });
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Verify contactno Otp
export const VerifyPhone = async (req, res) => {
    try {
        const { contactNo, email, otp } = req.body;

        if (!otp || (!contactNo && !email)) {
            return sendBadRequestResponse(res, "Please provide (contactNo or email) and OTP.");
        }

        const user = await User.findOne({
            $or: [
                contactNo ? { contactNo: contactNo } : null,
                contactNo ? { contactNo: '+91' + contactNo } : null,
                contactNo ? { contactNo: Number(contactNo) } : null,
                email ? { email: email.toLowerCase() } : null
            ].filter(Boolean)
        });

        if (!user) {
            return sendErrorResponse(res, 404, "User not found.");
        }

        if (!user.otp) {
            return sendBadRequestResponse(res, "No OTP found. Please request a new OTP.");
        }

        if (user.otp !== otp) {
            return sendBadRequestResponse(res, "Invalid OTP.");
        }

        user.lastLogin = new Date();
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        const token = await user.getJWT();
        if (!token) {
            return sendErrorResponse(res, 500, "Failed to generate token");
        }
        return sendSuccessResponse(res, "OTP verified successfully.", {
            token: token,
            id: user._id,
            name: user.name,
            email: user.email,
            contactNo: user.contactNo
        });

    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email, contactNo } = req.body;

        if (!email && !contactNo) {
            return sendBadRequestResponse(res, "Please provide either email or contact number");
        }

        // Find user by email or contactNo
        const user = await User.findOne({
            $or: [
                contactNo ? { contactNo: contactNo } : null,
                email ? { email: email.toLowerCase() } : null
            ].filter(Boolean)
        });

        if (!user) {
            return sendErrorResponse(res, 404, "User not found");
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await user.save();

        let sentTo = [];

        // Send to Phone if provided
        if (contactNo) {
            await phoneNoOtp(contactNo, otp);
            sentTo.push("mobile number");
        }

        // Send to Email if provided
        if (email) {
            await sendOtpEmail(email, otp);
            sentTo.push("email");
        }

        return sendSuccessResponse(res, `OTP sent to ${sentTo.join(" and ")}`, { email, contactNo });

    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

//Verify Otp
export const VerifyOtp = async (req, res) => {
    try {
        const { contactNo, email, otp } = req.body;

        if (!otp) {
            return sendBadRequestResponse(res, "OTP is required.");
        }

        if (!contactNo && !email) {
            return sendBadRequestResponse(res, "Please provide contactNo or email.");
        }

        // Search user by email or contactNo
        const user = await User.findOne({
            $or: [
                contactNo ? { contactNo: contactNo } : null,
                email ? { email: email.toLowerCase() } : null
            ].filter(Boolean)
        });

        if (!user) {
            return sendErrorResponse(res, 404, "User not found.");
        }

        if (!user.otp || !user.otpExpiry) {
            return sendBadRequestResponse(res, "No OTP found. Please request a new OTP.");
        }

        if (user.otp !== otp) {
            return sendBadRequestResponse(res, "Invalid OTP.");
        }

        if (user.otpExpiry < Date.now()) {
            return sendBadRequestResponse(res, "OTP has expired. Please request a new OTP.");
        }

        user.lastLogin = new Date();
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        const token = await user.getJWT();
        if (!token) {
            return sendErrorResponse(res, 500, "Failed to generate token");
        }

        return sendSuccessResponse(res, "OTP verified successfully.", {
            id: user._id,
            name: user.name,
            email: user.email,
            contactNo: user.contactNo,
            token: token
        });
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Reset Password using OTP
export const resetPassword = async (req, res) => {
    try {
        const { email, newPassword, confirmPassword } = req.body;
        if (!newPassword || !confirmPassword) {
            return sendBadRequestResponse(res, "Please provide email, newpassword and confirmpassword.");
        }

        const user = await User.findOne({ email: email });
        if (!user) {
            return sendErrorResponse(res, 400, "User Not Found");
        }

        if (!(newPassword === confirmPassword)) {
            return sendBadRequestResponse(res, "Please check newpassword and confirmpassword.");
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined;
        user.otpExpiry = undefined;
        await user.save();

        return sendSuccessResponse(res, "Password reset successfully.", { id: user._id, email: user.email });
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Change Password for user
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return sendBadRequestResponse(res, "currentPassword, newPassword, and confirmPassword are required.");
        }

        if (!req.user) {
            return sendUnauthorizedResponse(res, "You must be logged in to change your password.");
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return sendErrorResponse(res, 404, "User not found.");
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return sendBadRequestResponse(res, "Current password is incorrect.");
        }

        if (newPassword === currentPassword) {
            return sendBadRequestResponse(res, "New password cannot be the same as current password.");
        }

        if (newPassword !== confirmPassword) {
            return sendBadRequestResponse(res, "New password and confirm password do not match.");
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return sendSuccessResponse(res, "Password changed successfully.");
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const googleAuth = async (req, res) => {
    try {
        const { email, name, profilePic, uid } = req.body;

        if (!email && !uid) {
            return sendBadRequestResponse(res, "Email or UID is required for Google authentication");
        }

        let user = null;

        // Try finding by UID first if provided
        if (uid) {
            user = await User.findOne({ uid });
        }

        // If not found by UID, try finding by Email
        if (!user && email) {
            user = await User.findOne({ email: email.toLowerCase() });
            // If found by email but no UID, link the UID
            if (user && uid && !user.uid) {
                user.uid = uid;
                await user.save();
            }
        }

        if (!user) {
            // Create new user if they don't exist
            user = await User.create({
                email: email ? email.toLowerCase() : undefined,
                name: name,
                profilePic: profilePic,
                uid: uid,
                role: 'user',
            });
        } else {
            // Update lastLogin
            user.lastLogin = new Date();
            // Optionally update name/profilePic if they were missing
            if (name && !user.name) user.name = name;
            if (profilePic && !user.profilePic) user.profilePic = profilePic;
            if (uid && !user.uid) user.uid = uid;
            await user.save();
        }

        const token = await user.getJWT();
        if (!token) {
            return sendErrorResponse(res, 500, "Failed to generate token");
        }

        return sendSuccessResponse(res, "Google authentication successful", {
            id: user._id,
            name: user.name,
            email: user.email,
            profilePic: user.profilePic,
            uid: user.uid,
            token: token
        });
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

//logoutUser
// export const logoutUser = async (req, res) => {
//     try {
//         res.cookie("token", null, {
//             expires: new Date(Date.now()),
//             httpOnly: true,
//             path: "/"
//         });
//         return sendSuccessResponse(res, "User logout successfully...✅");
//     } catch (error) {
//         return sendErrorResponse(res, 400, error.message);
//     }
// };
