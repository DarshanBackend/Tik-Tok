import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import Report from "../models/reportModel.js";
import ReportCategory from "../models/reportCategoryModel.js";
import { sendBadRequestResponse, sendSuccessResponse, sendNotFoundResponse } from "../utils/ResponseUtils.js";

export const addReport = async (req, res) => {
    try {
        const { reportCategoryId, description } = req.body

        if (!reportCategoryId || !description) {
            return sendBadRequestResponse(res, "reportCategoryId and description are required!!!")
        }

        if (!mongoose.Types.ObjectId.isValid(reportCategoryId)) {
            return sendBadRequestResponse(res, "Invalid reportCategory Id!!!")
        }

        const existingreportCategory = await ReportCategory.findById(reportCategoryId);
        if (!existingreportCategory) {
            return sendNotFoundResponse(res, "ReportCategory not exist!!!");
        }

        const existingReport = await Report.findOne({ user: req.user._id });
        if (existingReport) {
            return sendBadRequestResponse(res, "You have already submitted a report.");
        }

        const report = new Report({
            reportCategoryId,
            description,
            user: req.user._id
        });

        await report.save();
        return sendSuccessResponse(res, "Report added successfully", report);

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllReports = async (req, res) => {
    try {
        const reports = await Report.find().populate('reportCategoryId').populate('user');
        if (!reports) {
            return sendNotFoundResponse(res, "No reports found");
        }

        if (!reports || reports.length === 0) {
            return sendBadRequestResponse(res, "No any Report found!!!")
        }

        return sendSuccessResponse(res, "Reports fetched successfully", reports);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getReportByUserId = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid User Id!!!");
        }
        const report = await Report.findOne({ user: id }).populate('reportCategoryId').populate('user','username');
        if (!report) {
            return sendNotFoundResponse(res, "Report not found");
        }
        return sendSuccessResponse(res, "Report fetched successfully", report);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
}

export const getReportById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Report Id!!!")
        }

        const report = await Report.findById(id).populate('reportCategoryId').populate('user',"username");
        if (!report) {
            return sendNotFoundResponse(res, "Report not found");
        }

        return sendSuccessResponse(res, "Report fetched successfully", report);

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updateReport = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Report Id!!!")
        }

        const { reportCategoryId } = req.body;

        if (reportCategoryId) {
            if (!mongoose.Types.ObjectId.isValid(reportCategoryId)) {
                return sendBadRequestResponse(res, "Invalid reportCategory Id!!!")
            }

            const existingreportCategory = await ReportCategory.findById(reportCategoryId);
            if (!existingreportCategory) {
                return sendNotFoundResponse(res, "ReportCategory not exist!!!");
            }
        }

        let report = await Report.findById(id);
        if (!report) {
            return sendNotFoundResponse(res, "Report not found");
        }

        report = await Report.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "Report updated successfully...", report)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Report Id!!!")
        }

        const report = await Report.findByIdAndDelete(id);
        if (!report) {
            return sendNotFoundResponse(res, "Report not found");
        }
        return sendSuccessResponse(res, "Report deleted successfully");
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};