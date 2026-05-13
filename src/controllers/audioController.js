import mongoose from "mongoose";
import Audio from "../models/audioModel.js";
import AudioCategory from "../models/audioCategoryModel.js";
import { ThrowError } from "../utils/ErrorUtils.js";
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";
import { deleteFromS3 } from "../utils/uploadS3.js";
import fs from "fs"
import path from 'path';



export const addAudio = async (req, res) => {
    try {
        const { audioCategoryId, audio_name, artist_name } = req.body;

        if (!req.files || !req.files.audio || !req.files.audio_image) {
            return sendBadRequestResponse(res, 'Both audio and audio_image files are required.');
        }

        const audioFile = req.files.audio[0];
        const imageFile = req.files.audio_image[0];

        if (!audioCategoryId || !audio_name || !artist_name) {
            return sendBadRequestResponse(res, "audioCategoryId, audio_name and artist_name are required!");
        }

        if (!mongoose.Types.ObjectId.isValid(audioCategoryId)) {
            return sendBadRequestResponse(res, "Invalid AudioCategoryId Id");
        }

        const category = await AudioCategory.findById(audioCategoryId);
        if (!category) {
            return sendBadRequestResponse(res, 'Audio category not found.');
        }

        const existingAudio = await Audio.findOne({ audioCategoryId, audio_name });
        if (existingAudio) {
            return sendBadRequestResponse(res, "This Audio already exists in the selected Category!");
        }

        const audioPath = audioFile.path;
        const imagePath = imageFile.path;

        const newAudio = await Audio.create({
            audioCategoryId,
            audio_name,
            artist_name,
            audio: audioPath,
            audio_image: imagePath
        });

        return sendSuccessResponse(res, "Audio created Successfully...", newAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get all Audio
export const getAllAudio = async (req, res) => {
    try {
        const audio = await Audio.find({});
        if (!audio || audio.length === 0) {
            return sendBadRequestResponse(res, "No Audio found!");
        }
        return sendSuccessResponse(res, "Audio fetched Successfully...", audio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get question by id
export const getAudioById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Audio Id");
        }
        const audio = await Audio.findById(id);
        if (!audio) {
            return sendBadRequestResponse(res, "Audio not found");
        }
        return sendSuccessResponse(res, "Audio fetched Successfully...", audio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getAudioByCategoryId = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Audio Category Id");
        }
        const audio = await Audio.find({ audioCategoryId: id });
        if (!audio || audio.length === 0) {
            return sendBadRequestResponse(res, "No Audio found!");
        }
        return sendSuccessResponse(res, "Audio fetched Successfully...", audio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Update audio
export const updateAudio = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Audio Id");
        }

        let audio = await Audio.findById(id);
        if (!audio) {
            return sendBadRequestResponse(res, "Audio not found");
        }

        if (req.body.audioCategoryId) {
            if (!mongoose.Types.ObjectId.isValid(req.body.audioCategoryId)) {
                return sendBadRequestResponse(res, "Invalid audioCategory Id");
            }
            const category = await AudioCategory.findById(req.body.audioCategoryId);
            if (!category) {
                return sendBadRequestResponse(res, 'Audio category not found.');
            }
        }

        const updateData = { ...req.body };

        if (req.files) {
            if (req.files.audio_image) {
                if (audio.audio_image && audio.audio_image.includes('.amazonaws.com/')) {
                    const oldKey = audio.audio_image.split('.amazonaws.com/')[1];
                    if (oldKey) deleteFromS3(oldKey).catch(err => console.error("Failed to delete old audio image from S3:", err));
                }
                const imageFile = req.files.audio_image[0];
                updateData.audio_image = imageFile.path;
            }

            if (req.files.audio) {
                if (audio.audio && audio.audio.includes('.amazonaws.com/')) {
                    const oldKey = audio.audio.split('.amazonaws.com/')[1];
                    if (oldKey) deleteFromS3(oldKey).catch(err => console.error("Failed to delete old audio file from S3:", err));
                }
                const audioFile = req.files.audio[0];
                updateData.audio = audioFile.path;
            }
        }

        const updatedAudio = await Audio.findByIdAndUpdate(id, updateData, { new: true });
        return sendSuccessResponse(res, "Audio Updated Successfully...", updatedAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Delete audio
export const deleteAudio = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Audio Id");
        }

        const audio = await Audio.findById(id);
        if (!audio) {
            return sendBadRequestResponse(res, "Audio not found");
        }

        // Delete associated files from S3
        if (audio.audio && audio.audio.includes('.amazonaws.com/')) {
            const key = audio.audio.split('.amazonaws.com/')[1];
            if (key) deleteFromS3(key).catch(err => console.error("Failed to delete audio file from S3:", err));
        }
        if (audio.audio_image && audio.audio_image.includes('.amazonaws.com/')) {
            const key = audio.audio_image.split('.amazonaws.com/')[1];
            if (key) deleteFromS3(key).catch(err => console.error("Failed to delete audio image from S3:", err));
        }

        const deletedAudio = await Audio.findByIdAndDelete(id);
        return sendSuccessResponse(res, "Audio Deleted Successfully...", deletedAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};