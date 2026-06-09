import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import PostReport from "../models/postReportModel.js";
import PostReportCategory from "../models/postReportCategoryModel.js";
import Post from "../models/postModel.js";
import { sendBadRequestResponse, sendSuccessResponse, sendNotFoundResponse } from "../utils/ResponseUtils.js";
export const addPostReport = async (req, res) => {
    try {
        const { postId, postReportCategoryId } = req.body;

        if (!postId || !postReportCategoryId) {
            return sendBadRequestResponse(res, "postId and postReportCategoryId are required!!!");
        }

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid post Id!!!");
        }

        if (!mongoose.Types.ObjectId.isValid(postReportCategoryId)) {
            return sendBadRequestResponse(res, "Invalid postReportCategory Id!!!");
        }

        const existingPostReportCategory = await PostReportCategory.findById(postReportCategoryId);
        if (!existingPostReportCategory) {
            return sendNotFoundResponse(res, "PostReportCategory does not exist!!!");
        }

        const existingPost = await Post.findById(postId);
        if (!existingPost) {
            return sendNotFoundResponse(res, "Post does not exist!!!");
        }

        const existingPostReport = await PostReport.findOne({ user: req.user._id, postId, postReportCategoryId });
        if (existingPostReport) {
            return sendBadRequestResponse(res, "You have already submitted a report for this category on this post.");
        }

        const postReport = new PostReport({
            postId,
            postReportCategoryId,
            user: req.user._id
        });

        await postReport.save();
        return sendSuccessResponse(res, "Post report submitted successfully", postReport);

    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getAllPostReports = async (req, res) => {
    try {
        const reports = await PostReport.find()
            .populate('postId')
            .populate('postReportCategoryId')
            .populate('user', 'username email profilePic');

        if (!reports || reports.length === 0) {
            return sendBadRequestResponse(res, "No post reports found!!!");
        }

        return sendSuccessResponse(res, "Post reports fetched successfully", reports);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getPostReportById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid post report Id!!!");
        }

        const report = await PostReport.findById(id)
            .populate('postId')
            .populate('postReportCategoryId')
            .populate('user', 'username email profilePic');

        if (!report) {
            return sendNotFoundResponse(res, "Post report not found");
        }

        return sendSuccessResponse(res, "Post report fetched successfully", report);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getPostReportsByPostId = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid Post Id!!!");
        }

        const reports = await PostReport.find({ postId })
            .populate('postId')
            .populate('postReportCategoryId')
            .populate('user', 'username email profilePic');

        if (!reports || reports.length === 0) {
            return sendNotFoundResponse(res, "No reports found for this post");
        }

        return sendSuccessResponse(res, "Post reports for post fetched successfully", reports);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const deletePostReport = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid post report Id!!!");
        }

        const report = await PostReport.findByIdAndDelete(id);
        if (!report) {
            return sendNotFoundResponse(res, "Post report not found");
        }

        return sendSuccessResponse(res, "Post report deleted successfully");
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};
