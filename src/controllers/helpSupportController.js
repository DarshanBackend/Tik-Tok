import mongoose from "mongoose";
import { ThrowError } from "../utils/ErrorUtils.js";
import HelpSupport from "../models/helpSupportModel.js"
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addHelpSupport = async (req, res) => {
    try {
        const { description } = req.body

        if (!description) {
            return sendBadRequestResponse(res, "Description are required!!!")
        }

        const helpSupport = await HelpSupport.create({
            description
        })

        return sendSuccessResponse(res, "HelpSupport created successfully...", helpSupport)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllHelpSupport = async (req, res) => {
    try {
        const helpSupport = await HelpSupport.find()

        if (!helpSupport || helpSupport.length === 0) {
            return sendBadRequestResponse(res, "No any HelpSupport found!!!")
        }

        return sendSuccessResponse(res, "HelpSupport fetched successfully...", helpSupport)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getHelpSupportById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid HelpSupport Id!!!")
        }

        const helpSupport = await HelpSupport.findById(id)
        if (!helpSupport) {
            return sendBadRequestResponse(res, "HelpSupport not found...")
        }

        return sendSuccessResponse(res, "HelpSupport fetched Successfully...", helpSupport)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updateHelpSupport = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid HelpSupport Id")
        }

        let helpSupport = await HelpSupport.findById(id)
        if (!helpSupport) {
            return sendBadRequestResponse(res, "HelpSupport not found!!!")
        }
        helpSupport = await HelpSupport.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "HelpSupport updated Successfully", helpSupport)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteHelpSupport = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid HelpSupport Id")
        }

        let helpSupport = await HelpSupport.findById(id)
        if (!helpSupport) {
            return sendBadRequestResponse(res, 'HelpSupport not found');
        }
        helpSupport = await HelpSupport.findByIdAndDelete(id);

        return sendSuccessResponse(res, "HelpSupport deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}