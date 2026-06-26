import mongoose from "mongoose";
import Audio from "../models/audioModel.js";
import AudioCategory from "../models/audioCategoryModel.js";
import User from "../models/userModel.js";
import Post from "../models/postModel.js";
import { ThrowError } from "../utils/ErrorUtils.js";
import { sendBadRequestResponse, sendSuccessResponse, sendNotFoundResponse, sendForbiddenResponse } from "../utils/ResponseUtils.js";
import { deleteFromS3 } from "../utils/uploadS3.js";
import fs from "fs";
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
        const { search } = req.query;
        
        const category = await AudioCategory.findOne({ audioCategory: "Original Audio" });
        const originalAudioCategoryId = category ? category._id : null;

        let query = {};
        if (originalAudioCategoryId) {
            query.audioCategoryId = { $ne: originalAudioCategoryId };
        }

        if (search) {
            query.$or = [
                { audio_name: { $regex: search, $options: "i" } },
                { artist_name: { $regex: search, $options: "i" } }
            ];
        }

        const audio = await Audio.find(query);
        if (!audio || audio.length === 0) {
            return sendBadRequestResponse(res, "No Audio found!");
        }

        const userId = req.user?._id;
        const user = userId ? await User.findById(userId).select("savedAudios") : null;
        const savedAudioIds = user?.savedAudios || [];

        const formattedAudio = audio.map(item => {
            const audioObj = item.toObject();
            return {
                ...audioObj,
                isSaved: savedAudioIds.some(id => id.toString() === audioObj._id.toString())
            };
        });

        return sendSuccessResponse(res, "Audio fetched Successfully...", formattedAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get audio by id
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

        const userId = req.user?._id;
        const user = userId ? await User.findById(userId).select("savedAudios") : null;
        const savedAudioIds = user?.savedAudios || [];

        const audioObj = audio.toObject();
        const formattedAudio = {
            ...audioObj,
            isSaved: savedAudioIds.some(id => id.toString() === audioObj._id.toString())
        };

        return sendSuccessResponse(res, "Audio fetched Successfully...", formattedAudio);
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

        const userId = req.user?._id;
        const user = userId ? await User.findById(userId).select("savedAudios") : null;
        const savedAudioIds = user?.savedAudios || [];

        const formattedAudio = audio.map(item => {
            const audioObj = item.toObject();
            return {
                ...audioObj,
                isSaved: savedAudioIds.some(id => id.toString() === audioObj._id.toString())
            };
        });

        return sendSuccessResponse(res, "Audio fetched Successfully...", formattedAudio);
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

// Toggle Save Audio
export const toggleSaveAudio = async (req, res) => {
    try {
        const audioId = req.params.id;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(audioId)) {
            return sendBadRequestResponse(res, "Invalid audioId");
        }

        const audio = await Audio.findById(audioId);
        if (!audio) {
            return sendNotFoundResponse(res, "Audio not found");
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendNotFoundResponse(res, "User not found");
        }

        if (!user.savedAudios) {
            user.savedAudios = [];
        }

        const isSaved = user.savedAudios.some(id => id.toString() === audioId.toString());

        if (isSaved) {
            await User.updateOne({ _id: userId }, { $pull: { savedAudios: audioId } });
            return res.status(200).json({
                type: "unsaved",
                message: "Audio removed from saved",
                success: true
            });
        } else {
            await User.updateOne({ _id: userId }, { $addToSet: { savedAudios: audioId } });
            return res.status(200).json({
                type: "saved",
                message: "Audio added to saved",
                success: true
            });
        }
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get Saved Audios
export const getSavedAudios = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId).populate({
            path: 'savedAudios'
        });

        if (!user) {
            return sendNotFoundResponse(res, "User not found");
        }

        const savedAudios = user.savedAudios.filter(audio => audio !== null);

        if (savedAudios.length === 0) {
            return sendBadRequestResponse(res, "No Saved Audios found...", []);
        }

        const formattedAudios = savedAudios.map(audio => {
            const audioObj = audio.toObject();
            return {
                ...audioObj,
                isSaved: true
            };
        });

        return sendSuccessResponse(res, "Saved audios fetched successfully...", formattedAudios);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get Trending Audios
export const getTrendingAudios = async (req, res) => {
    try {
        const userId = req.user._id;

        const category = await AudioCategory.findOne({ audioCategory: "Original Audio" });
        const originalAudioCategoryId = category ? category._id : null;

        const pipeline = [];
        if (originalAudioCategoryId) {
            pipeline.push({
                $match: { audioCategoryId: { $ne: originalAudioCategoryId } }
            });
        }

        pipeline.push(
            {
                $lookup: {
                    from: "posts",
                    let: { audioId: "$_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$audioId", "$$audioId"] },
                                        { $eq: ["$status", "published"] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: "posts"
                }
            },
            {
                $addFields: {
                    useCount: { $size: "$posts" }
                }
            },
            {
                $project: {
                    posts: 0
                }
            },
            {
                $sort: { useCount: -1, createdAt: -1 }
            }
        );

        const trendingAudios = await Audio.aggregate(pipeline);

        const user = await User.findById(userId).select("savedAudios");
        const savedAudioIds = user?.savedAudios || [];

        const formattedTrending = trendingAudios.map(audio => {
            return {
                ...audio,
                isSaved: savedAudioIds.some(id => id.toString() === audio._id.toString())
            };
        });

        return sendSuccessResponse(res, "Trending audios fetched successfully...", formattedTrending);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Import custom user audio
export const importAudio = async (req, res) => {
    try {
        const userId = req.user._id;
        const userDoc = await User.findById(userId);
        if (!userDoc) {
            return sendNotFoundResponse(res, "User not found");
        }

        if (!req.files || !req.files.audio) {
            return sendBadRequestResponse(res, "Audio file is required.");
        }

        const audioFile = req.files.audio[0];
        const audioPath = audioFile.path;

        let imagePath = "";
        if (req.files.audio_image && req.files.audio_image[0]) {
            imagePath = req.files.audio_image[0].path;
        } else {
            imagePath = userDoc.profilePic || "";
        }

        // Extract filename without extension as default audio name
        const originalName = audioFile.originalname || "";
        const defaultAudioName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName || `Original Audio`;

        const audio_name = req.body.audio_name || defaultAudioName;
        const artist_name = req.body.artist_name ? [req.body.artist_name] : [userDoc.name || 'User'];

        // Find or create "Original Audio" category
        let category = await AudioCategory.findOne({ audioCategory: "Original Audio" });
        if (!category) {
            category = await AudioCategory.create({ audioCategory: "Original Audio" });
        }

        const newAudio = await Audio.create({
            audioCategoryId: category._id,
            audio_name,
            artist_name,
            audio: audioPath,
            audio_image: imagePath,
            userId
        });

        return sendSuccessResponse(res, "Audio imported successfully", newAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get Original Audios
export const getOriginalAudios = async (req, res) => {
    try {
        const userId = req.user?._id;

        const category = await AudioCategory.findOne({ audioCategory: "Original Audio" });
        if (!category) {
            return sendSuccessResponse(res, "No original audios found", []);
        }

        // Only return original audios uploaded by the logged-in user
        const audio = await Audio.find({ audioCategoryId: category._id, userId: userId });
        if (!audio || audio.length === 0) {
            return sendSuccessResponse(res, "No original audios found", []);
        }

        const user = userId ? await User.findById(userId).select("savedAudios") : null;
        const savedAudioIds = user?.savedAudios || [];

        const formattedAudio = audio.map(item => {
            const audioObj = item.toObject();
            return {
                ...audioObj,
                isSaved: savedAudioIds.some(id => id.toString() === audioObj._id.toString())
            };
        });

        return sendSuccessResponse(res, "Original audios fetched successfully...", formattedAudio);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Delete original custom audio
export const deleteOriginalAudio = async (req, res) => {
    try {
        const audioId = req.params.id;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(audioId)) {
            return sendBadRequestResponse(res, "Invalid Audio Id");
        }

        const audio = await Audio.findById(audioId);
        if (!audio) {
            return sendNotFoundResponse(res, "Audio not found");
        }

        // Check ownership (admins can delete any audio)
        const userDoc = await User.findById(userId);
        const isOwner = (audio.userId && audio.userId.toString() === userId.toString()) ||
            (!audio.userId && userDoc && audio.artist_name.includes(userDoc.name));
        const isAdmin = req.user.isAdmin || req.user.role === 'admin';
        if (!isAdmin && !isOwner) {
            return sendForbiddenResponse(res, "You are not authorized to delete this audio.");
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

        await Audio.findByIdAndDelete(audioId);

        // Remove from user's saved lists
        await User.updateMany(
            { savedAudios: audioId },
            { $pull: { savedAudios: audioId } }
        );

        return sendSuccessResponse(res, "Original audio deleted successfully");
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Get Audio by Reels
export const getAudioByReels = async (req, res) => {
    try {
        const { audioId } = req.params;
        const viewerId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(audioId)) {
            return sendBadRequestResponse(res, "Invalid audioId");
        }

        const blockedByUsers = await User.find({ blockedUsers: viewerId }).distinct("_id");

        const posts = await Post.find({
            audioId: audioId,
            user: { $nin: blockedByUsers },
            status: "published",
        })
            .sort({ createdAt: -1 })
            .populate({ path: "user", select: "profilePic name followers username" })
            .populate({ path: "audioId", select: "audio_name audio_image audio artist_name" });

        if (!posts || posts.length === 0) {
            return sendSuccessResponse(res, "No posts found with this audio", []);
        }

        const formattedPosts = posts.map((post) => {
            const postObj = post.toObject();
            let isFollowing = false;

            if (viewerId && postObj.user && Array.isArray(postObj.user.followers)) {
                isFollowing = postObj.user.followers.some(
                    (followerId) => followerId.toString() === viewerId.toString()
                );
            }

            if (postObj.user && postObj.user.followers) {
                delete postObj.user.followers;
            }

            let isLike = false;
            if (viewerId && Array.isArray(postObj.likes)) {
                isLike = postObj.likes.some(
                    (likeId) => likeId.toString() === viewerId.toString()
                );
            }

            return {
                ...postObj,
                isFollowing,
                isLike
            };
        });

        return sendSuccessResponse(res, "Posts fetched successfully by audio ID", formattedPosts);
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

// Update custom/original audio uploaded by a specific user
export const updateAudioForUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendBadRequestResponse(res, "Invalid Audio Id");
        }

        let audio = await Audio.findById(id);
        if (!audio) {
            return sendNotFoundResponse(res, "Audio not found");
        }

        // Validate Ownership
        const userDoc = await User.findById(userId);
        const isOwner = (audio.userId && audio.userId.toString() === userId.toString()) ||
            (!audio.userId && userDoc && audio.artist_name.includes(userDoc.name));
        const isAdmin = req.user.isAdmin || req.user.role === 'admin';

        if (!isAdmin && !isOwner) {
            return sendForbiddenResponse(res, "You are not authorized to update this audio.");
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

        // Ensure artist_name remains an array in schema
        if (req.body.artist_name) {
            updateData.artist_name = Array.isArray(req.body.artist_name)
                ? req.body.artist_name
                : [req.body.artist_name];
        }

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