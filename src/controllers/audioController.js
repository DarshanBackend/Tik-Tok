import mongoose from "mongoose";
import Audio from "../models/audioModel.js";
import AudioCategory from "../models/audioCategoryModel.js";
import { ThrowError } from "../utils/ErrorUtils.js";
import { sendBadRequestResponse, sendSuccessResponse } from "../utils/ResponseUtils.js";
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
            try {
                fs.unlinkSync(audioFile.path);
                fs.unlinkSync(imageFile.path);
            } catch (err) { console.error("Failed to delete uploaded files:", err); }
            return sendBadRequestResponse(res, "audioCategoryId, audio_name and artist_name are required!");
        }

        if (!mongoose.Types.ObjectId.isValid(audioCategoryId)) {
            try {
                fs.unlinkSync(audioFile.path);
                fs.unlinkSync(imageFile.path);
            } catch (err) { console.error("Failed to delete uploaded files:", err); }
            return sendBadRequestResponse(res, "Invalid AudioCategoryId Id");
        }

        const category = await AudioCategory.findById(audioCategoryId);
        if (!category) {
            try {
                fs.unlinkSync(audioFile.path);
                fs.unlinkSync(imageFile.path);
            } catch (err) { console.error("Failed to delete uploaded files:", err); }
            return sendBadRequestResponse(res, 'Audio category not found.');
        }

        const existingAudio = await Audio.findOne({ audioCategoryId, audio_name });
        if (existingAudio) {
            try {
                fs.unlinkSync(audioFile.path);
                fs.unlinkSync(imageFile.path);
            } catch (err) { console.error("Failed to delete uploaded files:", err); }
            return sendBadRequestResponse(res, "This Audio already exists in the selected Category!");
        }

        const audioPath = `/public/audio/${path.basename(audioFile.path)}`;
        const imagePath = `/public/audio_image/${path.basename(imageFile.path)}`;

        const newAudio = await Audio.create({
            audioCategoryId,
            audio_name,
            artist_name,
            audio: audioPath,
            audio_image: imagePath
        });

        return sendSuccessResponse(res, "Audio created Successfully...", newAudio);
    } catch (error) {
        if (req.files && req.files.audio) {
            try { fs.unlinkSync(req.files.audio[0].path); } catch (err) { console.error("Failed to delete uploaded audio file:", err); }
        }
        if (req.files && req.files.audio_image) {
            try { fs.unlinkSync(req.files.audio_image[0].path); } catch (err) { console.error("Failed to delete uploaded image file:", err); }
        }
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

// Update audio
export const updateAudio = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            if (req.files) {
                if (req.files.audio) fs.unlinkSync(req.files.audio[0].path);
                if (req.files.audio_image) fs.unlinkSync(req.files.audio_image[0].path);
            }
            return sendBadRequestResponse(res, "Invalid Audio Id");
        }

        let audio = await Audio.findById(id);
        if (!audio) {
            if (req.files) {
                if (req.files.audio) fs.unlinkSync(req.files.audio[0].path);
                if (req.files.audio_image) fs.unlinkSync(req.files.audio_image[0].path);
            }
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
                const imageFile = req.files.audio_image[0];
                updateData.audio_image = `/public/audio_image/${path.basename(imageFile.path)}`;
                if (audio.audio_image) {
                    const oldImagePath = path.join(process.cwd(), audio.audio_image);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
            }

            if (req.files.audio) {
                const audioFile = req.files.audio[0];
                updateData.audio = `/public/audio/${path.basename(audioFile.path)}`;
                if (audio.audio) {
                    const oldAudioPath = path.join(process.cwd(), audio.audio);
                    if (fs.existsSync(oldAudioPath)) {
                        fs.unlinkSync(oldAudioPath);
                    }
                }
            }
        }

        const updatedAudio = await Audio.findByIdAndUpdate(id, updateData, { new: true });
        return sendSuccessResponse(res, "Audio Updated Successfully...", updatedAudio);
    } catch (error) {
        if (req.files) {
            if (req.files.audio) {
                try { fs.unlinkSync(req.files.audio[0].path); } catch (err) { console.error("Failed to delete uploaded audio file:", err); }
            }
            if (req.files.audio_image) {
                try { fs.unlinkSync(req.files.audio_image[0].path); } catch (err) { console.error("Failed to delete uploaded image file:", err); }
            }
        }
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

        // Delete audio file if it exists
        if (audio.audio) {
            const oldAudioPath = path.join(process.cwd(), audio.audio);
            if (fs.existsSync(oldAudioPath)) {
                try { fs.unlinkSync(oldAudioPath); } catch (err) { console.error("Failed to delete audio file:", oldAudioPath, err); }
            }
        }

        // Delete image file if it exists
        if (audio.audio_image) {
            const oldImagePath = path.join(process.cwd(), audio.audio_image);
            if (fs.existsSync(oldImagePath)) {
                try { fs.unlinkSync(oldImagePath); } catch (err) { console.error("Failed to delete image file:", oldImagePath, err); }
            }
        }

        const deletedAudio = await Audio.findByIdAndDelete(id);
        return sendSuccessResponse(res, "Audio Deleted Successfully...", deletedAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};