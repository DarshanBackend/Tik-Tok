import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import ReportCategory from "../models/reportCategoryModel.js";
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addReportCategory = async (req, res) => {
    try {
        const { reportCategoryType } = req.body

        if (!reportCategoryType) {
            return sendBadRequestResponse(res, "reportCategoryType are required!!!")
        }

        const reportCategory = await ReportCategory.findOne({reportCategoryType})
        if (reportCategory) {
            return sendBadRequestResponse(res, "This ReportCategory already added!!!")
        }

        const newReportCategory = await ReportCategory.create({
            reportCategoryType
        })

        return sendSuccessResponse(res, "ReportCategory added successfully...", newReportCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllReportCategory = async (req, res) => {
    try {
        const reportCategory = await ReportCategory.find()

        if (!reportCategory || reportCategory.length === 0) {
            return sendBadRequestResponse(res, "No any ReportCategory found!!!")
        }

        return sendSuccessResponse(res, "ReportCategory fetched successfully...", reportCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getReportCategoryById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid ReportCategory Id!!!")
        }

        const reportCategory = await ReportCategory.findById(id)
        if (!reportCategory) {
            return sendBadRequestResponse(res, "ReportCategory not found...")
        }

        return sendSuccessResponse(res, "ReportCategory fetched Successfully...", reportCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updateReportCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid ReportCategory Id")
        }

        let reportCategory = await ReportCategory.findById(id)
        if (!reportCategory) {
            return sendBadRequestResponse(res, "ReportCategory not found!!!")
        }
        reportCategory = await ReportCategory.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "ReportCategory updated Successfully", reportCategory)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteReportCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid ReportCategory Id")
        }

        let reportCategory = await ReportCategory.findById(id)
        if (!reportCategory) {
            return sendBadRequestResponse(res, 'ReportCategory not found');
        }
        reportCategory = await ReportCategory.findByIdAndDelete(id);

        return sendSuccessResponse(res, "ReportCategory deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

