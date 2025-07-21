import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import PrivacyPolicy from "../models/privacyPolicyModel.js"
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addPrivacyPolicy = async (req, res) => {
    try {
        const { description } = req.body

        if (!description) {
            return sendBadRequestResponse(res, "Description are required!!!")
        }

        const privacyPolicy = await PrivacyPolicy.create({
            description
        })

        return sendSuccessResponse(res, "PrivacyPolicy created successfully...", privacyPolicy)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllPrivacyPolicy = async (req, res) => {
    try {
        const privacyPolicy = await PrivacyPolicy.find()

        if (!privacyPolicy || privacyPolicy.length === 0) {
            return sendBadRequestResponse(res, "No any PrivacyPolicy found!!!")
        }

        return sendSuccessResponse(res, "PrivacyPolicy fetched successfully...", privacyPolicy)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getPrivacyPolicyById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid PrivacyPolicy Id!!!")
        }

        const privacyPolicy = await PrivacyPolicy.findById(id)
        if (!privacyPolicy) {
            return sendBadRequestResponse(res, "PrivacyPolicy not found...")
        }

        return sendSuccessResponse(res, "PrivacyPolicy fetched Successfully...", privacyPolicy)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updatePrivacyPolicy = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid PrivacyPolicy Id")
        }

        let privacyPolicy = await PrivacyPolicy.findById(id)
        if (!privacyPolicy) {
            return sendBadRequestResponse(res, "PrivacyPolicy not found!!!")
        }
        privacyPolicy = await PrivacyPolicy.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "PrivacyPolicy updated Successfully", privacyPolicy)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deletePrivacyPolicy = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid PrivacyPolicy Id")
        }

        let privacyPolicy = await PrivacyPolicy.findById(id)
        if (!privacyPolicy) {
            return sendBadRequestResponse(res, 'PrivacyPolicy not found');
        }
        privacyPolicy = await PrivacyPolicy.findByIdAndDelete(id);

        return sendSuccessResponse(res, "PrivacyPolicy deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}