import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import Audio from '../models/audioModel.js'; // Import the Audio model
import Comment from '../models/commentModel.js'; // Import the Comment model
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse, sendNotFoundResponse } from '../utils/ResponseUtils.js';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import moment from "moment";
import { getReceiverSocketId, io } from '../socket/socket.js';
import { ThrowError } from '../utils/ErrorUtils.js';


export const addNewPost = async (req, res) => {
    try {
        const { caption, status, audioId } = req.body;
        let taggedFriends = req.body.taggedFriends;

        const imageFile = req.files?.post_image?.[0];
        const videoFile = req.files?.post_video?.[0];
        const userId = req.user._id;

        if (!caption && !imageFile && !videoFile) {
            return sendBadRequestResponse(res, 'Post must have a caption, image, or video.');
        }

        const user = await User.findById(userId);
        if (!user) return sendBadRequestResponse(res, 'User not found.');

        // Parse taggedFriends (in case it's a JSON string or stringified array)
        if (typeof taggedFriends === 'string') {
            taggedFriends = JSON.parse(taggedFriends);
        }

        // ✅ Filter valid and unique ObjectIds only
        taggedFriends = Array.isArray(taggedFriends)
            ? [...new Set(taggedFriends.filter(id => mongoose.Types.ObjectId.isValid(id) && id !== userId.toString()))]
            : [];

        // Validate audioId if present
        if (audioId && !mongoose.Types.ObjectId.isValid(audioId)) {
            imageFile && fs.unlinkSync(imageFile.path);
            videoFile && fs.unlinkSync(videoFile.path);
            return sendBadRequestResponse(res, 'Invalid Audio ID format.');
        }

        let imageUrl = imageFile ? `/public/post_images/${path.basename(imageFile.path)}` : '';
        let videoUrl = videoFile ? `/public/post_videos/${path.basename(videoFile.path)}` : '';

        // Create post
        const newPost = await Post.create({
            user: userId,
            caption,
            image: imageUrl,
            video: videoUrl,
            audioId,
            status: status || 'published',
            taggedFriends
        });

        user.posts.push(newPost._id);
        await user.save();

        // ✅ Add post to tagged users' taggedPosts
        if (taggedFriends.length > 0) {
            await User.updateMany(
                { _id: { $in: taggedFriends } },
                { $addToSet: { taggedPosts: newPost._id } }
            );
        }

        await newPost.populate('user', '-password');
        await newPost.populate('audioId');

        return sendSuccessResponse(res, 'Post created successfully.', newPost);
    } catch (error) {
        console.error("Error in addNewPost:", error);
        req.files?.post_image?.[0]?.path && fs.unlinkSync(req.files.post_image[0].path);
        req.files?.post_video?.[0]?.path && fs.unlinkSync(req.files.post_video[0].path);
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

        if (!mongoose.Types.ObjectId.isValid(audioId)) {
            return sendBadRequestResponse(res, "Invalid audioId")
        }

        const posts = await Post.find({ audioId: audioId })
            .populate("user", "username profilePic");

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

export const getTaggedPosts = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId).populate({
            path: "taggedPosts",
            populate: { path: "user", select: "username profilePic" }
        });
        if (!user) {
            return sendBadRequestResponse(res, "User not found.");
        }

        // Filter: show only posts not created by the logged-in user
        const taggedByOthers = user.taggedPosts.filter(post => {
            return post.user._id.toString() !== userId.toString();
        });

        if (taggedByOthers.length === 0) {
            return sendSuccessResponse(res, "No tagged posts found", []);
        }

        return sendSuccessResponse(res, "Tagged posts fetched successfully.", taggedByOthers);
    } catch (err) {
        return sendErrorResponse(res, 500, err.message);
    }
};

export const savePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid postId..")
        }

        const post = await Post.findById(postId)
        if (!post || post.length === 0) {
            return sendNotFoundResponse(res, "Post not found!!!")
        }

        const user = await User.findById(userId)
        if (!user) {
            return sendNotFoundResponse(res, "User not found!!!")
        }

        if (user.saved.includes(post._id)) {
            await user.updateOne({ $pull: { saved: post._id } })
            await user.save()
            return res.status(200).json({
                type: "unsaved",
                message: "post removed from bookmark",
                success: true
            })
        } else {
            await user.updateOne({ $addToSet: { saved: post._id } })
            await user.save()
            return res.status(200).json({
                type: "saved",
                message: "post add to saved",
                success: true
            })
        }
    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}





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

export const getLikedPostsByUser = async (req, res) => {
    try {
        const userId = req.user._id;

        const user = await User.findById(userId).select("liked");
        if (!user || !user.liked || user.liked.length === 0) {
            return sendSuccessResponse(res, "User has not liked any posts.", []);
        }

        // Get posts liked by the user
        const likedPosts = await Post.find({ _id: { $in: user.liked } })
            .populate("user", "username profilePic")
            .sort({ createdAt: -1 });

        return sendSuccessResponse(res, "Liked posts fetched successfully.", likedPosts);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};




export const commentPost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const { text } = req.body;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid post Id");
        }

        const post = await Post.findById(postId);
        if (!post) {
            return sendBadRequestResponse(res, "No Post found");
        }

        const user = await User.findById(userId);
        if (!text) {
            return sendBadRequestResponse(res, "Comment can not be empty...");
        }

        const comment = await Comment.create({
            text,
            user: userId,
            post: postId
        });

        await comment.populate({
            path: "user",
            select: "username profilepic",
        });

        post.comments.push(comment._id);
        await post.save();

        await User.updateOne({ _id: userId }, { $addToSet: { comments: postId } });

        if (post.user._id.toString() !== userId.toString()) {
            const notification = {
                type: "comment",
                userId,
                userDetails: user,
                postId,
                message: `commented on your post.`,
            };

            const receiverSocketId = getReceiverSocketId(post.user._id.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("notification", notification);
            }
        }

        // ✅ Add timeAgo to the comment response
        const duration = moment.duration(moment().diff(comment.createdAt));
        let timeAgo = '';
        if (duration.asSeconds() < 60) {
            timeAgo = `${Math.floor(duration.asSeconds())}s`;
        } else if (duration.asMinutes() < 60) {
            timeAgo = `${Math.floor(duration.asMinutes())}m`;
        } else if (duration.asHours() < 24) {
            timeAgo = `${Math.floor(duration.asHours())}h`;
        } else if (duration.asDays() < 30) {
            timeAgo = `${Math.floor(duration.asDays())}d`;
        } else if (duration.asMonths() < 12) {
            timeAgo = `${Math.floor(duration.asMonths())}mo`;
        } else {
            timeAgo = `${Math.floor(duration.asYears())}y`;
        }

        return sendSuccessResponse(res, "Comment added...", {
            ...comment._doc,
            timeAgo
        });

    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const replyComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user._id;
        const { text } = req.body;

        if (!text) return sendBadRequestResponse(res, "Reply cannot be empty");

        const parentComment = await Comment.findById(commentId);
        if (!parentComment) return sendBadRequestResponse(res, "Comment not found");

        const reply = await Comment.create({
            text,
            user: userId,
            post: parentComment.post,
            parent: commentId,
        });

        parentComment.replies.push(reply._id);
        await parentComment.save();

        await reply.populate("user", "username profilepic");

        // ✅ Add timeAgo formatting
        const duration = moment.duration(moment().diff(reply.createdAt));
        let timeAgo = '';
        if (duration.asSeconds() < 60) {
            timeAgo = `${Math.floor(duration.asSeconds())}s`;
        } else if (duration.asMinutes() < 60) {
            timeAgo = `${Math.floor(duration.asMinutes())}m`;
        } else if (duration.asHours() < 24) {
            timeAgo = `${Math.floor(duration.asHours())}h`;
        } else if (duration.asDays() < 30) {
            timeAgo = `${Math.floor(duration.asDays())}d`;
        } else if (duration.asMonths() < 12) {
            timeAgo = `${Math.floor(duration.asMonths())}mo`;
        } else {
            timeAgo = `${Math.floor(duration.asYears())}y`;
        }

        return sendSuccessResponse(res, "Reply added", {
            ...reply._doc,
            timeAgo
        });

    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const deleteReplyComment = async (req, res) => {
    try {
        const { replyId } = req.params;
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(replyId)) {
            return sendBadRequestResponse(res, "Invalid reply ID.");
        }

        const reply = await Comment.findById(replyId);
        if (!reply) {
            return sendBadRequestResponse(res, "Reply not found.");
        }

        // Only allow the user who made the reply or the admin to delete
        if (reply.user.toString() !== userId.toString() && !req.user.isAdmin) {
            return sendBadRequestResponse(res, "You are not authorized to delete this reply.");
        }

        // Remove reply ID from parent comment's replies array
        if (reply.parent) {
            await Comment.findByIdAndUpdate(reply.parent, {
                $pull: { replies: reply._id },
            });
        }

        // Delete the reply comment
        await Comment.findByIdAndDelete(replyId);

        return sendSuccessResponse(res, "Reply deleted successfully.");
    } catch (error) {
        return ThrowError(res, 500, error.message);
    }
};

export const getCommentOfPost = async (req, res) => {
    try {
        const postId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return sendBadRequestResponse(res, "Invalid postId");
        }

        const comments = await Comment.find({ post: postId, parent: null })
            .populate("user", "username profilepic")
            .populate({
                path: "replies",
                populate: {
                    path: "user",
                    select: "username profilePic",
                }
            })
            .sort({ createdAt: -1 });

        if (!comments || comments.length === 0) {
            return res.status(404).json({
                message: "No comments yet",
                success: false,
            });
        }

        // ✅ Format comments with timeAgo and nested replies
        const formattedComments = comments.map(comment => {
            const duration = moment.duration(moment().diff(comment.createdAt));
            let timeAgo = '';
            if (duration.asSeconds() < 60) {
                timeAgo = `${Math.floor(duration.asSeconds())}s`;
            } else if (duration.asMinutes() < 60) {
                timeAgo = `${Math.floor(duration.asMinutes())}m`;
            } else if (duration.asHours() < 24) {
                timeAgo = `${Math.floor(duration.asHours())}h`;
            } else if (duration.asDays() < 30) {
                timeAgo = `${Math.floor(duration.asDays())}d`;
            } else if (duration.asMonths() < 12) {
                timeAgo = `${Math.floor(duration.asMonths())}mo`;
            } else {
                timeAgo = `${Math.floor(duration.asYears())}y`;
            }

            const formattedReplies = comment.replies.map(reply => {
                const replyDuration = moment.duration(moment().diff(reply.createdAt));
                let replyAgo = '';
                if (replyDuration.asSeconds() < 60) {
                    replyAgo = `${Math.floor(replyDuration.asSeconds())}s`;
                } else if (replyDuration.asMinutes() < 60) {
                    replyAgo = `${Math.floor(replyDuration.asMinutes())}m`;
                } else if (replyDuration.asHours() < 24) {
                    replyAgo = `${Math.floor(replyDuration.asHours())}h`;
                } else if (replyDuration.asDays() < 30) {
                    replyAgo = `${Math.floor(replyDuration.asDays())}d`;
                } else if (replyDuration.asMonths() < 12) {
                    replyAgo = `${Math.floor(replyDuration.asMonths())}mo`;
                } else {
                    replyAgo = `${Math.floor(replyDuration.asYears())}y`;
                }

                return {
                    _id: reply._id,
                    text: reply.text,
                    user: reply.user,
                    timeAgo: replyAgo,
                };
            });

            return {
                _id: comment._id,
                text: comment.text,
                user: comment.user,
                timeAgo,
                replies: formattedReplies
            };
        });

        return sendSuccessResponse(res, "Comment fetched successfully", formattedComments);

    } catch (error) {
        console.log(error);
        return ThrowError(res, 500, error.message);
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

        return sendSuccessResponse(res, 'Draft published successfully.', {
            ...post._doc,
            postDate: moment(post.createdAt).format("D MMM, YYYY"),
        });
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

        const formattedDrafts = drafts.map(draft => ({
            ...draft._doc,
            draftDate: moment(draft.createdAt).format("D MMM, YYYY")
        }));

        return sendSuccessResponse(res, 'Drafts fetched successfully.', formattedDrafts);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

