import { sendForbiddenResponse, sendUnauthorizedResponse } from '../utils/ResponseUtils.js';
import Register from '../models/registerModel.js';

// Middleware to check if the user has access to the requested user's data
export const checkUserAccess = async (req, res, next) => {
    try {
        // If user is not authenticated
        if (!req.admin) {
            return sendUnauthorizedResponse(res, "Authentication required");
        }

        // If user is an admin, they have full access to all user data.
        // The specific filtering by userId will be handled in the controller if needed.
        if (req.admin.isAdmin) {
            req.user = req.admin; // Set req.user to the admin's info (for consistency, as they can access all)
            return next();
        }

        // If user is a regular user
        // Regular users can only access their own data. If an ID is provided in params, it must match their own ID.
        if (req.params.id && req.admin._id.toString() !== req.params.id) {
            return sendForbiddenResponse(res, "Access denied. You can only access your own data.");
        }

        // If no ID is provided, or if the ID matches the user's own ID, allow access to their own data.
        req.user = req.admin;
        next();
    } catch (error) {
        console.error("Error in checkUserAccess middleware:", error);
        return sendForbiddenResponse(res, "Error checking access permissions");
    }
};

// Middleware to check if the user has access to the requested admin's data
export const checkAdminAccess = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // If user is not authenticated
        if (!req.admin) {
            return sendUnauthorizedResponse(res, "Authentication required");
        }

        // If user is an admin
        if (req.admin.isAdmin) {
            // Check if the admin exists
            const admin = await Register.findOne({ _id: id, type: 'admin' });
            if (!admin) {
                return sendForbiddenResponse(res, "Admin not found");
            }
            // Admins can access any admin's data
            req.targetAdmin = admin;
            return next();
        }

        // If user is a regular user
        if (req.admin._id.toString() !== id) {
            return sendForbiddenResponse(res, "Access denied. You can only access your own data.");
        }

        // Regular user can access their own data
        req.targetAdmin = req.admin;
        next();
    } catch (error) {
        return sendForbiddenResponse(res, "Error checking access permissions");
    }
}; 