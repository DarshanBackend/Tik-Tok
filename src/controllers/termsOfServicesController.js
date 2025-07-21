import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import TermsOfServices from "../models/termsOfServicesModel.js"
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addTermsOfServices = async (req, res) => {
    try {
        const { description } = req.body

        if (!description) {
            return sendBadRequestResponse(res, "Description are required!!!")
        }

        const termsOfServices = await TermsOfServices.create({
            description
        })

        return sendSuccessResponse(res,  "termsOfServices created successfully...", termsOfServices)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllTermsOfServices = async (req, res) => {
    try {
        const termsOfServices = await TermsOfServices.find()

        if (!termsOfServices || termsOfServices.length === 0) {
            return sendBadRequestResponse(res, "No any termsOfServices found!!!")
        }

        return sendSuccessResponse(res, "TermsOfServices fetched successfully...", termsOfServices)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getTermsOfServicesById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid TermsOfServices Id!!!")
        }

        const termsOfServices = await TermsOfServices.findById(id)
        if (!termsOfServices) {
            return sendBadRequestResponse(res, "TermsOfServices not found...")
        }

        return sendSuccessResponse(res, "TermsOfServices fetched Successfully...", termsOfServices)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updateTermsOfServices = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid TermsOfServices Id")
        }

        let termsOfServices = await TermsOfServices.findById(id)
        if (!termsOfServices) {
            return sendBadRequestResponse(res, "TermsOfServices not found!!!")
        }
        termsOfServices = await TermsOfServices.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "TermsOfServices updated Successfully", termsOfServices)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteTermsOfServices = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid TermsOfServices Id")
        }

        let termsOfServices = await TermsOfServices.findById(id)
        if (!termsOfServices) {
            return sendBadRequestResponse(res, 'TermsOfServices not found');
        }
        termsOfServices = await TermsOfServices.findByIdAndDelete(id);

        return sendSuccessResponse(res, "TermsOfServices deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}