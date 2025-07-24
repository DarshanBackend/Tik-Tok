import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import Audio from '../models/audioModel.js'; // Import the Audio model
import Comment from '../models/commentModel.js'; // Import the Comment model
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse } from '../utils/ResponseUtils.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { getReceiverSocketId, io } from '../socket/socket.js';
import { ThrowError } from '../utils/ErrorUtils.js';


export const addNewPost = async (req, res) => {
    try {
        const { caption, status, audioId } = req.body;
        const imageFile = req.files?.post_image?.[0];
        const videoFile = req.files?.post_video?.[0];
        const userId = req.user._id;

        if (!caption && !imageFile && !videoFile) {
            return sendBadRequestResponse(res, 'Post must have a caption, image, or video.');
        }

        const user = await User.findById(userId);
        if (!user) {
            return sendBadRequestResponse(res, 'User not found.');
        }

        if (audioId) {
            if (!mongoose.Types.ObjectId.isValid(audioId)) {
                if (req.files?.post_image?.[0]?.path) {
                    fs.unlinkSync(req.files.post_image[0].path);
                }
                if (req.files?.post_video?.[0]?.path) {
                    fs.unlinkSync(req.files.post_video[0].path);
                }
                return sendBadRequestResponse(res, 'Invalid Audio ID format.');
            }
            const audio = await Audio.findById(audioId);
            if (!audio) {
                if (req.files?.post_image?.[0]?.path) {
                    fs.unlinkSync(req.files.post_image[0].path);
                }
                if (req.files?.post_video?.[0]?.path) {
                    fs.unlinkSync(req.files.post_video[0].path);
                }
                return sendBadRequestResponse(res, 'Audio track not found.');
            }
        }

        let imageUrl = '';
        let videoUrl = '';

        if (imageFile) {
            imageUrl = `/public/post_images/${path.basename(imageFile.path)}`;
        }

        if (videoFile) {
            videoUrl = `/public/post_videos/${path.basename(videoFile.path)}`;
        }

        const newPost = await Post.create({
            user: userId,
            caption,
            image: imageUrl,
            video: videoUrl,
            audioId: audioId, // Corrected field name to match the model
            status: status || 'published'
        });

        user.posts.push(newPost._id);
        await user.save();

        await newPost.populate('user', '-password');
        await newPost.populate('audioId'); // Corrected field name for population

        return sendSuccessResponse(res, 'Post created successfully.', newPost);
    } catch (error) {
        console.error("Error in addNewPost:", error); // Added for better debugging
        if (req.files?.post_image?.[0]?.path) {
            fs.unlinkSync(req.files.post_image[0].path);
        }
        if (req.files?.post_video?.[0]?.path) {
            fs.unlinkSync(req.files.post_video[0].path);
        }
        return sendErrorResponse(res, 500, error.message);
    }
};

export const getAllPost = async (req, res) => {
    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate({ path: "user", select: "username profilePic" })
            .populate({
                path: "comments",
                sort: { createdAt: -1 },
                populate: { path: "user", select: "username profilePic" }, // Corrected path to 'user'
            });

        return sendSuccessResponse(res, "post fetched successfully...", posts)
    } catch (error) {
        console.log(error);
    }
};

export const getUserPost = async (req, res) => {
    try {
        const user = req.user._id;
        const posts = await Post.find({ user: user })
            .sort({ createdAt: -1 })
            .populate({
                path: "user",
                select: "username profilePic",
            })
            .populate({
                path: "comments",
                sort: { createdAt: -1 },
                populate: { path: "author", select: "username, profilePic" },
            });


        if (!posts || posts.length === 0) {
            return sendBadRequestResponse(res, 'post not found!!!');
        }

        return sendSuccessResponse(res, "post fetched successfully", posts)
    } catch (error) {
        console.log(error);
    }
};

export const getFollowingUsersPosts = async (req, res) => {
    try {
        const loggedInUserId = req.user._id; // Assume middleware sets req.user

        const user = await User.findById(loggedInUserId);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        const followings = user.followings;

        // Fetch posts from followed users
        const posts = await Post.find({ user: { $in: followings } })
            .populate("user", "username profilePic fullname")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Posts from followed users fetched successfully",
            posts,
        });

    } catch (error) {
        console.error("Error fetching followed users' posts:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch posts",
        });
    }
};

export const getPostsByAudioId = async (req, res) => {
    try {
        const { audioId } = req.params;

        if (!audioId || typeof audioId !== "string") {
            return sendBadRequestResponse(res, "Invalid or missing audioId");
        }

        // match posts where audio path contains audioId (e.g. uploads/audio/audioId.mp3)
        const audioRegex = new RegExp(`${audioId}\\.mp3$`, 'i'); // end with audioId.mp3

        const posts = await Post.find({ audio: audioRegex })
            .populate("user", "username profilepic");

        if (!posts || posts.length === 0) {
            return sendSuccessResponse(res, "No posts found with this audio", []);
        }

        return sendSuccessResponse(res, "Posts fetched successfully", posts);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const updatePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { caption, status } = req.body;
        const userId = req.user._id;

        const imageFile = req.files?.post_image?.[0];
        const videoFile = req.files?.post_video?.[0];

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, 'Invalid post ID format.');
        }

        const post = await Post.findOne({ _id: postId, user: userId });
        if (!post) {
            return sendBadRequestResponse(res, 'Post not found or not authorized.');
        }

        // Update caption and status
        if (caption) post.caption = caption;
        if (status) post.status = status;

        // Replace image if new one uploaded
        if (imageFile) {
            if (post.image) {
                const oldImagePath = path.join(process.cwd(), post.image);
                if (fs.existsSync(oldImagePath)) {
                    try { fs.unlinkSync(oldImagePath); } catch (err) { console.error("Failed to delete old image:", err); }
                }
            }
            post.image = `/public/post_images/${path.basename(imageFile.path)}`;
        }

        // Replace video if new one uploaded
        if (videoFile) {
            if (post.video) {
                const oldVideoPath = path.join(process.cwd(), post.video);
                if (fs.existsSync(oldVideoPath)) {
                    try { fs.unlinkSync(oldVideoPath); } catch (err) { console.error("Failed to delete old video:", err); }
                }
            }
            post.video = `/public/post_videos/${path.basename(videoFile.path)}`;
        }

        await post.save();

        return sendSuccessResponse(res, 'Post updated successfully.', post);
    } catch (error) {
        console.error("Update post error:", error);
        // Cleanup uploaded files if save fails
        if (req.files?.post_image?.[0]?.path) {
            try { fs.unlinkSync(req.files.post_image[0].path); } catch { }
        }
        if (req.files?.post_video?.[0]?.path) {
            try { fs.unlinkSync(req.files.post_video[0].path); } catch { }
        }
        return sendErrorResponse(res, 500, error.message);
    }
};

export const deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, 'Invalid postID format.');
        }

        // Only find posts created by the user
        const post = await Post.findOne({ _id: postId, user: userId });
        if (!post) {
            return sendBadRequestResponse(res, 'Post not found or not owned by you.');
        }

        // Delete image file if exists
        if (post.image) {
            const imagePath = path.join(process.cwd(), post.image);
            if (fs.existsSync(imagePath)) {
                try { fs.unlinkSync(imagePath); } catch (err) { console.error("Image deletion failed:", err); }
            }
        }

        // Delete video file if exists
        if (post.video) {
            const videoPath = path.join(process.cwd(), post.video);
            if (fs.existsSync(videoPath)) {
                try { fs.unlinkSync(videoPath); } catch (err) { console.error("Video deletion failed:", err); }
            }
        }

        // Delete the post itself
        await Post.deleteOne({ _id: postId });

        // Remove post reference from user's posts array
        await User.findByIdAndUpdate(userId, {
            $pull: { posts: postId }
        });

        // Delete all comments related to this post
        await Comment.deleteMany({ post: postId });

        return sendSuccessResponse(res, 'Post deleted successfully.');
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};



export const likePost = async (req, res) => {
    try {
        const likedUser = req.user._id;
        const postId = req.params.id;
        const post = await Post.findById(postId);

        if (!post) {
            return res
                .status(404)
                .json({ message: "Post not found", success: false });
        }

        await Post.updateOne({ _id: postId }, { $addToSet: { likes: likedUser } });
        await User.updateOne({ _id: likedUser }, { $addToSet: { liked: postId } });

        const user = await User.findById(likedUser).select("username profilePic");
        const postOwnerId = post.user.toString();

        if (postOwnerId !== likedUser) {
            const notification = {
                type: "like",
                userId: likedUser,
                userDetails: user,
                postId,
                message: `Liked your post`,
            };

            const postOwnerSocketId = getReceiverSocketId(postOwnerId);

            if (postOwnerSocketId) {
                io.to(postOwnerSocketId).emit("notification", notification);
            }
        }

        return res.status(200).json({ message: "Post liked", success: true });
    } catch (error) {
        console.error("Error liking post:", error);
        return res
            .status(500)
            .json({ message: "Something went wrong", success: false });
    }
};

export const getLikeOfPost = async (req, res) => {
    try {
        const postId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid postId")
        }

        const post = await Post.findById(postId).populate(
            "likes",
            "username profilepic"
        );

        if (!post || post.likes.length === 0) {
            return res.status(404).json({
                message: "No likes yet",
                success: false,
            });
        }

        return sendSuccessResponse(res, "like fetched successfully", post.likes)
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const dislikePost = async (req, res) => {
    try {
        const userId = req.user._id;
        const postId = req.params.id;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({
                message: "Post not found",
                success: false,
            });
        }

        await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
        await User.updateOne({ _id: userId }, { $pull: { liked: postId } });


        // Implement socket.io for real-time notifications (if applicable)
        const user = await User.findById(userId).select("username profilePic");
        const postOwnerId = post.user.toString();
        if (postOwnerId !== userId) {
            // emit a notification event
            const notification = {
                type: "dislike",
                userId: userId,
                userDetails: user,
                postId,
                message: `Unliked your post`,
            };
            const postOwnerSocketId = getReceiverSocketId(postOwnerId);
            io.to(postOwnerSocketId).emit("notification", notification);
        }
        return res.status(200).json({
            message: "Post unliked",
            success: true,
        });
    } catch (error) {
        console.error("Error unliking post:", error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
            error: error.message,
        });
    }
};



export const commentPost = async (req, res) => {
    try {
        const postId = req.params.id
        const userId = req.user._id
        const { text } = req.body

        if (postId) {
            if (!mongoose.Types.ObjectId.isValid(postId)) {
                return sendBadRequestResponse(res, "Invalid post Id")
            }
            var post = await Post.findById(postId)
            if (!post) {
                return sendBadRequestResponse(res, "No Post found")
            }
        }

        const user = await User.findById(userId)

        if (!text) {
            return sendBadRequestResponse(res, "Comment can not be empty...")
        }

        const comment = await Comment.create({
            text,
            user: userId,
            post: postId
        })

        await comment.populate({
            path: "user",
            select: "username profilepic",
        })

        post.comments.push(comment._id)

        await post.save()
        await User.updateOne({ _id: userId }, { $addToSet: { comments: postId } })

        if (post.user._id.toString() !== userId) {

            const notification = {
                type: "comment",
                userId: userId,
                userDetails: user,
                postId,
                message: `commented on your post.`,
            };

            const receiverSocketId = getReceiverSocketId(post.user._id.toString());

            if (receiverSocketId) {
                io.to(receiverSocketId).emit("notification", notification);
            }
        }

        return sendSuccessResponse(res, "Comment added...", comment)
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}

export const getCommentOfPost = async (req, res) => {
    try {
        const postId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid postId")
        }

        const comments = await Comment.find({ post: postId }).populate(
            "user",
            "username profilepic"
        );

        if (!comments || comments.length === 0) {
            return res.status(404).json({
                message: "No comments yet",
                success: false,
            });
        }

        return sendSuccessResponse(res, "comment fetched successfully", comments)
    } catch (error) {
        console.log(error);
    }
};

export const updateComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user._id;
        const { text } = req.body;

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return sendBadRequestResponse(res, "Invalid comment ID");
        }

        const comment = await Comment.findById(commentId);

        if (!comment) {
            return sendBadRequestResponse(res, "Comment not found");
        }

        if (comment.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "you can only update own comment" });
        }

        if (!text) {
            return sendBadRequestResponse(res, "Comment text cannot be empty");
        }

        comment.text = text;
        await comment.save();

        return sendSuccessResponse(res, "Comment updated successfully", comment);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return sendBadRequestResponse(res, "Invalid comment ID");
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return sendBadRequestResponse(res, "Comment not found");
        }

        if (comment.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "you can only delete own comment" });
        }

        // Remove comment ID from post.comments[]
        await Post.findByIdAndUpdate(comment.post, {
            $pull: { comments: comment._id }
        });

        // Remove comment ID from user.comments[]
        await User.findByIdAndUpdate(userId, {
            $pull: { comments: comment.post }
        });

        await Comment.findByIdAndDelete(commentId);

        return sendSuccessResponse(res, "Comment deleted successfully");
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};



export const publishDraft = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, 'Invalid postID format.');
        }

        const post = await Post.findOne({ _id: postId, user: userId });

        if (!post) {
            return sendBadRequestResponse(res, 'Draft not found or you do not have permission to publish it.');
        }

        if (post.status === 'draft') {
            return sendBadRequestResponse(res, 'This post has already been draft.');
        }

        post.status = 'draft';
        await post.save();

        return sendSuccessResponse(res, 'Draft published successfully.', post);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const removeDraft = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, 'Invalid postID format.');
        }

        const post = await Post.findOne({ _id: postId, user: userId });

        if (!post) {
            return sendBadRequestResponse(res, 'Draft not found or you do not have permission to publish it.');
        }

        if (post.status !== 'draft') {
            return sendBadRequestResponse(res, 'Only drafts can be removed.');
        }

        if (post.image) {
            const imagePath = path.join(process.cwd(), post.image);
            if (fs.existsSync(imagePath)) {
                try { fs.unlinkSync(imagePath); } catch (err) { console.error("Failed to delete image file:", err); }
            }
        }

        // Delete associated video file
        if (post.video) {
            const videoPath = path.join(process.cwd(), post.video);
            if (fs.existsSync(videoPath)) {
                try { fs.unlinkSync(videoPath); } catch (err) { console.error("Failed to delete video file:", err); }
            }
        }

        // Delete the post
        await Post.deleteOne({ _id: postId });

        // Remove post from user's post list
        await User.findByIdAndUpdate(userId, {
            $pull: { posts: postId }
        });

        return sendSuccessResponse(res, 'Draft and its media deleted successfully.');
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const getDrafts = async (req, res) => {
    try {
        const userId = req.user._id;
        const drafts = await Post.find({ user: userId, status: 'draft' }).populate('user', '-password');

        if (!drafts || drafts.length === 0) {
            return sendBadRequestResponse(res, "No any draft post found!!!")
        }

        return sendSuccessResponse(res, 'Drafts fetched successfully.', drafts);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

