import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import Restrict from "../models/restrictModel.js";
import RestrictCategory from "../models/restrictCategoryModel.js";
import User from "../models/userModel.js";
import { sendBadRequestResponse, sendSuccessResponse, sendNotFoundResponse } from "../utils/ResponseUtils.js";

export const addRestrict = async (req, res) => {
    try {
        const { restrictCategoryId, description } = req.body;
        const targetUserId = req.body.restrictedUserId || req.body.targetUserId;

        if (!restrictCategoryId || !description || !targetUserId) {
            return sendBadRequestResponse(res, "restrictCategoryId, description, and restrictedUserId are required!!!");
        }

        if (!mongoose.Types.ObjectId.isValid(restrictCategoryId)) {
            return sendBadRequestResponse(res, "Invalid restrictCategory Id!!!");
        }

        if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
            return sendBadRequestResponse(res, "Invalid restrictedUserId!!!");
        }

        // Prevent user from restricting their own account
        if (targetUserId.toString() === req.user._id.toString()) {
            return sendBadRequestResponse(res, "You cannot restrict your own account!!!");
        }

        const existingRestrictCategory = await RestrictCategory.findById(restrictCategoryId);
        if (!existingRestrictCategory) {
            return sendNotFoundResponse(res, "RestrictCategory does not exist!!!");
        }

        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            return sendNotFoundResponse(res, "User to restrict does not exist!!!");
        }

        const existingRestrict = await Restrict.findOne({
            user: req.user._id,
            restrictedUser: targetUserId,
            restrictCategoryId
        });
        if (existingRestrict) {
            return sendBadRequestResponse(res, "You have already submitted a restrict for this category against this user.");
        }

        const restrict = new Restrict({
            restrictCategoryId,
            description,
            user: req.user._id,
            restrictedUser: targetUserId
        });

        await restrict.save();
        return sendSuccessResponse(res, "Restrict added successfully", restrict);

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllRestricts = async (req, res) => {
    try {
        const restricts = await Restrict.find()
            .populate('restrictCategoryId')
            .populate('user', 'username')
            .populate('restrictedUser', 'username');

        if (!restricts) {
            return sendNotFoundResponse(res, "No restricts found");
        }

        if (restricts.length === 0) {
            return sendBadRequestResponse(res, "No any Restrict found!!!")
        }

        return sendSuccessResponse(res, "Restricts fetched successfully", restricts);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getRestrictByUserId = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid User Id!!!");
        }
        const restricts = await Restrict.find({
            $or: [{ user: id }, { restrictedUser: id }]
        }).populate('restrictCategoryId').populate('user', 'username').populate('restrictedUser', 'username');

        if (!restricts || restricts.length === 0) {
            return sendNotFoundResponse(res, "Restricts not found");
        }
        return sendSuccessResponse(res, "Restricts fetched successfully", restricts);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
}

export const getRestrictById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Restrict Id!!!")
        }

        const restrict = await Restrict.findById(id)
            .populate('restrictCategoryId')
            .populate('user', "username")
            .populate('restrictedUser', 'username');

        if (!restrict) {
            return sendNotFoundResponse(res, "Restrict not found");
        }

        return sendSuccessResponse(res, "Restrict fetched successfully", restrict);

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getRestrictByRestrictCategoryId = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid RestrictCategory Id!!!");
        }
        const restricts = await Restrict.find({ restrictCategoryId: id })
            .populate('restrictCategoryId')
            .populate('user', 'username')
            .populate('restrictedUser', 'username');

        if (!restricts || restricts.length === 0) {
            return sendNotFoundResponse(res, "Restricts not found");
        }
        return sendSuccessResponse(res, "Restricts fetched successfully", restricts);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
}

export const updateRestrict = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Restrict Id!!!")
        }

        const { restrictCategoryId, restrictedUserId, targetUserId } = req.body;
        const targetId = restrictedUserId || targetUserId;

        if (restrictCategoryId) {
            if (!mongoose.Types.ObjectId.isValid(restrictCategoryId)) {
                return sendBadRequestResponse(res, "Invalid restrictCategory Id!!!")
            }

            const existingRestrictCategory = await RestrictCategory.findById(restrictCategoryId);
            if (!existingRestrictCategory) {
                return sendNotFoundResponse(res, "RestrictCategory not exist!!!");
            }
        }

        if (targetId) {
            if (!mongoose.Types.ObjectId.isValid(targetId)) {
                return sendBadRequestResponse(res, "Invalid restrictedUserId!!!")
            }

            const targetUser = await User.findById(targetId);
            if (!targetUser) {
                return sendNotFoundResponse(res, "User to restrict does not exist!!!");
            }

            if (targetId.toString() === req.user._id.toString()) {
                return sendBadRequestResponse(res, "You cannot restrict your own account!!!");
            }
        }

        let restrict = await Restrict.findById(id);
        if (!restrict) {
            return sendNotFoundResponse(res, "Restrict not found");
        }

        const updateData = { ...req.body };
        if (targetId) {
            updateData.restrictedUser = targetId;
        }

        restrict = await Restrict.findByIdAndUpdate(id, updateData, { new: true })

        return sendSuccessResponse(res, "Restrict updated successfully...", restrict)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteRestrict = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Restrict Id!!!")
        }

        const restrict = await Restrict.findByIdAndDelete(id);
        if (!restrict) {
            return sendNotFoundResponse(res, "Restrict not found");
        }
        return sendSuccessResponse(res, "Restrict deleted successfully");
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};