import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import PostReportCategory from "../models/postReportCategoryModel.js";
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addPostReportCategory = async (req, res) => {
    try {
        const { postReportCategoryType } = req.body

        if (!postReportCategoryType) {
            return sendBadRequestResponse(res, "postReportCategoryType are required!!!")
        }

        const postReportCategory = await PostReportCategory.findOne({ postReportCategoryType })
        if (postReportCategory) {
            return sendBadRequestResponse(res, "This PostReportCategory already added!!!")
        }

        const newPostReportCategory = await PostReportCategory.create({
            postReportCategoryType
        })

        return sendSuccessResponse(res, "Post ReportCategory added successfully...", newPostReportCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllPostReportCategory = async (req, res) => {
    try {
        const postReportCategory = await PostReportCategory.find()

        if (!postReportCategory || postReportCategory.length === 0) {
            return sendBadRequestResponse(res, "No any PostReportCategory found!!!")
        }

        return sendSuccessResponse(res, "PostReportCategory fetched successfully...", postReportCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getPostReportCategoryById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Post ReportCategory Id!!!")
        }

        const postReportCategory = await PostReportCategory.findById(id)
        if (!postReportCategory) {
            return sendBadRequestResponse(res, "Post ReportCategory not found...")
        }

        return sendSuccessResponse(res, "Post ReportCategory fetched Successfully...", postReportCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updatePostReportCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Post ReportCategory Id")
        }

        let postReportCategory = await PostReportCategory.findById(id)
        if (!postReportCategory) {
            return sendBadRequestResponse(res, "PostReportCategory not found!!!")
        }
        postReportCategory = await PostReportCategory.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "PostReportCategory updated Successfully", postReportCategory)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deletePostReportCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Post ReportCategory Id")
        }

        let postReportCategory = await PostReportCategory.findById(id)
        if (!postReportCategory) {
            return sendBadRequestResponse(res, 'Post ReportCategory not found');
        }
        postReportCategory = await PostReportCategory.findByIdAndDelete(id);

        return sendSuccessResponse(res, "Post ReportCategory deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

