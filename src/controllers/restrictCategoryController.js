import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import RestrictCategory from "../models/restrictCategoryModel.js";
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addRestrictCategory = async (req, res) => {
    try {
        const { restrictCategoryType } = req.body

        if (!restrictCategoryType) {
            return sendBadRequestResponse(res, "restrictCategoryType is required!!!")
        }

        const restrictCategory = await RestrictCategory.findOne({ restrictCategoryType })
        if (restrictCategory) {
            return sendBadRequestResponse(res, "This RestrictCategory already added!!!")
        }

        const newRestrictCategory = await RestrictCategory.create({
            restrictCategoryType
        })

        return sendSuccessResponse(res, "RestrictCategory added successfully...", newRestrictCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllRestrictCategory = async (req, res) => {
    try {
        const restrictCategory = await RestrictCategory.find()

        if (!restrictCategory || restrictCategory.length === 0) {
            return sendBadRequestResponse(res, "No any RestrictCategory found!!!")
        }

        return sendSuccessResponse(res, "RestrictCategory fetched successfully...", restrictCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getRestrictCategoryById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid RestrictCategory Id!!!")
        }

        const restrictCategory = await RestrictCategory.findById(id)
        if (!restrictCategory) {
            return sendBadRequestResponse(res, "RestrictCategory not found...")
        }

        return sendSuccessResponse(res, "RestrictCategory fetched Successfully...", restrictCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updateRestrictCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid RestrictCategory Id")
        }

        let restrictCategory = await RestrictCategory.findById(id)
        if (!restrictCategory) {
            return sendBadRequestResponse(res, "RestrictCategory not found!!!")
        }
        restrictCategory = await RestrictCategory.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "RestrictCategory updated Successfully", restrictCategory)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteRestrictCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid RestrictCategory Id")
        }

        let restrictCategory = await RestrictCategory.findById(id)
        if (!restrictCategory) {
            return sendBadRequestResponse(res, 'RestrictCategory not found');
        }
        restrictCategory = await RestrictCategory.findByIdAndDelete(id);

        return sendSuccessResponse(res, "RestrictCategory deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}
