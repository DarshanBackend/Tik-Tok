import User from "../models/userModel.js";
import { ThrowError } from "../utils/ErrorUtils.js"
import bcrypt from "bcryptjs";
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse, sendUnauthorizedResponse } from '../utils/ResponseUtils.js';
import nodemailer from "nodemailer"
import { phoneNoOtp } from "./userController.js";
import twilio from 'twilio';



const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

const phoneNoOtp = async (contactNo, otp) => {
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
async function sendOtpEmail(email, otp) {
    // Configure your transporter (update with your SMTP details)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    await transporter.sendMail({
        from: '"Your App" <no-reply@yourapp.com>',
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}`,
    });
}

export const userLogin = async (req, res) => {
    try {
        const { email, password, contactNo } = req.body;

        // 1. Contact Number Login (OTP)
        if (contactNo && !email && !password) {
            // Generate OTP (e.g., 6 digit random number)
            const otp = Math.floor(100000 + Math.random() * 900000);

            // Send OTP to contactNo
            await phoneNoOtp(contactNo, otp);

            // You should store the OTP in DB or cache (e.g., Redis) with expiry for verification step
            // For now, just return success
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
            token: token
        });
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Verify contactno Otp
export const VerifyPhone = async (req, res) => {
    try {
        const { contactNo, otp } = req.body;

        if (!contactNo || !otp) {
            return sendBadRequestResponse(res, "Please provide contactNo and OTP.");
        }

        const user = await User.findOne({
            $or: [
                { contactNo: contactNo },
                { contactNo: '+91' + contactNo },
                { contactNo: Number(contactNo) }
            ]
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

        user.otp = undefined;
        await user.save();

        const token = await user.getJWT();
        if (!token) {
            return sendErrorResponse(res, 500, "Failed to generate token");
        }
        return sendSuccessResponse(res, "OTP verified successfully.", { token: token });



    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email, contactNo } = req.body;

        // 1. Forgot by Contact Number
        if (contactNo && !email) {
            const otp = Math.floor(100000 + Math.random() * 900000);

            // Send OTP to contactNo
            await phoneNoOtp(contactNo, otp);

            // TODO: Store OTP in DB or cache for verification (not shown here)
            // Example: await OtpModel.create({ contactNo, otp, expiresAt: Date.now() + 5*60*1000 });

            return sendSuccessResponse(res, "OTP sent to contact number", { contactNo });
        }

        // 2. Forgot by Email
        if (email && !contactNo) {
            const otp = Math.floor(100000 + Math.random() * 900000);

            // Find user by email
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                return sendErrorResponse(res, 404, "User not found");
            }

            // Send OTP to email
            await sendOtpEmail(email, otp);

            // TODO: Store OTP in DB or cache for verification (not shown here)
            // Example: await OtpModel.create({ email, otp, expiresAt: Date.now() + 5*60*1000 });

            return sendSuccessResponse(res, "OTP sent to email", { email });
        }

        // If neither provided
        return sendBadRequestResponse(res, "Please provide either email or contact number");

    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

//Verify Email Otp
export const VerifyEmail = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return sendBadRequestResponse(res, "Please provide email and OTP.");
        }

        const user = await User.findOne({ email: email });
        if (!user) {
            return sendErrorResponse(res, 404, "User not found.");
        }

        // Check if OTP exists and is not expired
        if (!user.otp || !user.otpExpiry) {
            return sendBadRequestResponse(res, "No OTP found. Please request a new OTP.");
        }

        if (user.otp !== otp) {
            return sendBadRequestResponse(res, "Invalid OTP.");
        }

        if (user.otpExpiry < Date.now()) {
            return sendBadRequestResponse(res, "OTP has expired. Please request a new OTP.");
        }

        await user.save();

        return sendSuccessResponse(res, "OTP verified successfully.");

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
        const { oldPassword, newPassword, confirmPassword } = req.body;

        if (!oldPassword || !newPassword || !confirmPassword) {
            return sendBadRequestResponse(res, "oldPassword, newPassword, and confirmPassword are required.");
        }

        // Get user from the authenticated request
        const user = await User.findById(req.user._id);
        if (!user) {
            return sendErrorResponse(res, 404, "User not found");
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return sendBadRequestResponse(res, "Current password is incorrect.");
        }

        if (newPassword === oldPassword) {
            return sendBadRequestResponse(res, "New password cannot be the same as current password.");
        }

        if (newPassword !== confirmPassword) {
            return sendBadRequestResponse(res, "New password and confirm password do not match.");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        return sendSuccessResponse(res, "Password changed successfully.");

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
