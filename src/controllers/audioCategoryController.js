import mongoose from "mongoose";
import AudioCategory from "../models/audioCategoryModel.js";
import { ThrowError } from "../utils/ErrorUtils.js";
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";

export const addAudioCategory = async (req, res) => {
    try {
        const { audioCategory } = req.body

        if (!audioCategory) {
            return sendBadRequestResponse(res, "audioCategory are required!!!")
        }

        const existaudioCategory = await AudioCategory.findOne({ audioCategory })
        if (existaudioCategory) {
            return sendBadRequestResponse(res, "This audioCategory already added!!!")
        }

        const newAudioCategory = await AudioCategory.create({
            audioCategory
        })

        return sendSuccessResponse(res, "AudioCategory added successfully...", newAudioCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAllAudioCategory = async (req, res) => {
    try {
        const audioCategory = await AudioCategory.find()

        if (!audioCategory || audioCategory.length === 0) {
            return sendBadRequestResponse(res, "No any AudioCategory found!!!")
        }

        return sendSuccessResponse(res, "AudioCategory fetched successfully...", audioCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getAudioCategoryById = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid AudioCategory Id!!!")
        }

        const audioCategory = await AudioCategory.findById(id)
        if (!audioCategory) {
            return sendBadRequestResponse(res, "AudioCategory not found...")
        }

        return sendSuccessResponse(res, "AudioCategory fetched Successfully...", audioCategory)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const updateAudioCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid AudioCategory Id")
        }

        let audioCategory = await AudioCategory.findById(id)
        if (!audioCategory) {
            return sendBadRequestResponse(res, "AudioCategory not found!!!")
        }
        audioCategory = await AudioCategory.findByIdAndUpdate(id, { ...req.body }, { new: true })

        return sendSuccessResponse(res, "AudioCategory updated Successfully", audioCategory)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const deleteAudioCategory = async (req, res) => {
    try {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid AudioCategory Id")
        }

        let audioCategory = await AudioCategory.findById(id)
        if (!audioCategory) {
            return sendBadRequestResponse(res, 'AudioCategory not found');
        }
        audioCategory = await AudioCategory.findByIdAndDelete(id);

        return sendSuccessResponse(res, "AudioCategory deleted Successfully...")
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

