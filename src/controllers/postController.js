import Post from '../models/postModel.js';
import User from '../models/userModel.js';
import Comment from '../models/commentModel.js'; // Import the Comment model
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse, sendNotFoundResponse, sendForbiddenResponse } from '../utils/ResponseUtils.js';
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
        const viewerId = req.user._id;

        const blockedByUsers = await User.find({ blockedUsers: viewerId }).distinct("_id");

        const posts = await Post.find({ user: { $nin: blockedByUsers } })
            .sort({ createdAt: -1 })
            .populate({ path: "user", select: "username profilePic" })
            .populate({
                path: "comments",
                sort: { createdAt: -1 },
                populate: { path: "user", select: "username profilePic" },
            });

        return sendSuccessResponse(res, "post fetched successfully...", posts)
    } catch (error) {
        console.log(error);
    }
};

export const getPostsByUserId = async (req, res) => {
    try {
        const viewerId = req.user._id;
        const userId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return sendBadRequestResponse(res, "Invalid userId");
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) return sendBadRequestResponse(res, "User not found");

        // 🔒 If you are blocked by the target user
        if (targetUser.blockedUsers.includes(viewerId)) {
            return sendForbiddenResponse(res, "You are blocked by this user.");
        }

        // 🔒 If account is private and viewer is not the same user or follower
        if (targetUser.isPrivate) {
            const isFollower = targetUser.followers.some(
                (followerId) => followerId.toString() === viewerId.toString()
            );

            if (!isFollower && viewerId.toString() !== userId) {
                return sendForbiddenResponse(res, "This account is private.");
            }
        }

        // ✅ Fetch and return published posts
        const posts = await Post.find({ user: userId, status: "published" })
            .populate("user", "username profilePic")
            .sort({ createdAt: -1 });

        return sendSuccessResponse(res, "Posts fetched successfully.", posts);
    } catch (err) {
        console.error("Error fetching user posts:", err);
        return sendErrorResponse(res, 500, err.message);
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
                populate: { path: "user", select: "username, profilePic" },
            });


        if (!posts || posts.length === 0) {
            return sendBadRequestResponse(res, 'post not found!!!');
        }

        return sendSuccessResponse(res, "post fetched successfully", posts)
    } catch (error) {
        console.log(error);
    }
};

export const getFriendsProfile = async (req, res) => {
    try {
        const userId = req.user._id;

        // Get the logged-in user's following list
        const user = await User.findById(userId);
        if (!user) return sendBadRequestResponse(res, "User not found.");

        const followingIds = user.followings || [];

        if (followingIds.length === 0) {
            return sendSuccessResponse(res, "You are not following anyone yet.", []);
        }

        // Fetch profiles of followed users
        const profiles = await User.find({
            _id: { $in: followingIds },
            blockedUsers: { $ne: userId }  // Exclude users who blocked this user
        })

        return sendSuccessResponse(res, "Profile from followed users fetched successfully.", profiles);
    } catch (error) {
        console.error("Error in getFriendsPosts:", error);
        return sendErrorResponse(res, 500, error.message);
    }
};

export const getFollowingUsersPosts = async (req, res) => {
    try {
        const loggedInUserId = req.user._id;

        const user = await User.findById(loggedInUserId);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false });
        }

        const blockedByUsers = await User.find({ blockedUsers: loggedInUserId }).distinct("_id");

        const posts = await Post.find({
            user: { $in: user.followings, $nin: blockedByUsers }
        })
            .populate("user", "username profilePic fullname")
            .sort({ createdAt: -1 });

        if (!posts || posts.length === 0) {
            return sendNotFoundResponse(res, "No any post found...")
        }

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
        const viewerId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(audioId)) {
            return sendBadRequestResponse(res, "Invalid audioId")
        }

        const blockedByUsers = await User.find({ blockedUsers: viewerId }).distinct("_id");

        const posts = await Post.find({
            audioId: audioId,
            user: { $nin: blockedByUsers }
        })
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
            populate: { path: "user", select: "username profilePic blockedUsers" }
        });

        if (!user) {
            return sendBadRequestResponse(res, "User not found.");
        }

        // Filter: only posts not by self AND not blocked by post owner
        const taggedByOthers = user.taggedPosts.filter(post => {
            const postOwner = post.user;
            const isBlocked = postOwner.blockedUsers?.includes(userId);
            return postOwner._id.toString() !== userId.toString() && !isBlocked;
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

        const postOwner = await User.findById(post.user);
        if (postOwner.blockedUsers.includes(userId)) {
            return sendForbiddenResponse(res, "You are blocked by this user.");
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

export const getSavedPosts = async (req, res) => {
    try {
        const userId = req.user._id

        const user = await User.findById(userId).populate({
            path: 'saved',
            match: { status: 'published' },
            populate: {
                path: 'user',
                select: 'username profilePic'
            }
        })

        if (!user) {
            return sendNotFoundResponse(res, "User not found...")
        }

        const savePosts = user.saved.filter(post => post !== null);

        return sendSuccessResponse(res, "Saved posts fetched successfully...", savePosts)

    } catch (error) {
        return ThrowError(res, 500, error.message)
    }
}



export const toggleLikePost = async (req, res) => {
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

        const postOwner = await User.findById(post.user);

        if (postOwner.blockedUsers.includes(userId)) {
            return sendForbiddenResponse(res, "You are blocked by this user");
        }

        const alreadyLiked = post.likes.includes(userId);

        if (alreadyLiked) {
            // Dislike (unlike)
            await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
            await User.updateOne({ _id: userId }, { $pull: { liked: postId } });

            const user = await User.findById(userId).select("username profilePic");
            const postOwnerId = post.user.toString();

            if (postOwnerId !== userId) {
                const notification = {
                    type: "dislike",
                    userId: userId,
                    userDetails: user,
                    postId,
                    message: `Unliked your post`,
                };

                const postOwnerSocketId = getReceiverSocketId(postOwnerId);
                if (postOwnerSocketId) {
                    io.to(postOwnerSocketId).emit("notification", notification);
                }
            }

            return res.status(200).json({
                message: "Post unliked",
                success: true,
            });
        } else {
            // Like
            await Post.updateOne({ _id: postId }, { $addToSet: { likes: userId } });
            await User.updateOne({ _id: userId }, { $addToSet: { liked: postId } });

            const user = await User.findById(userId).select("username profilePic");
            const postOwnerId = post.user.toString();

            if (postOwnerId !== userId) {
                const notification = {
                    type: "like",
                    userId: userId,
                    userDetails: user,
                    postId,
                    message: `Liked your post`,
                };

                const postOwnerSocketId = getReceiverSocketId(postOwnerId);
                if (postOwnerSocketId) {
                    io.to(postOwnerSocketId).emit("notification", notification);
                }
            }

            return res.status(200).json({
                message: "Post liked",
                success: true,
            });
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        return res.status(500).json({
            message: "Something went wrong",
            success: false,
            error: error.message,
        });
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




function getTimeAgo(timestamp) {
    const duration = moment.duration(moment().diff(timestamp));
    if (duration.asSeconds() < 60) return `${Math.floor(duration.asSeconds())}s`;
    if (duration.asMinutes() < 60) return `${Math.floor(duration.asMinutes())}m`;
    if (duration.asHours() < 24) return `${Math.floor(duration.asHours())}h`;
    if (duration.asDays() < 30) return `${Math.floor(duration.asDays())}d`;
    if (duration.asMonths() < 12) return `${Math.floor(duration.asMonths())}mo`;
    return `${Math.floor(duration.asYears())}y`;
}

async function populateReplies(comment, depth = 0, currentUserId = null) {
    await comment.populate("user", "username profilePic");
    await comment.populate("replies");

    const formatted = {
        _id: comment._id,
        text: comment.text,
        user: comment.user,
        timeAgo: getTimeAgo(comment.createdAt),
        likeCount: comment.likeComment.length,
        isLikedByUser: currentUserId
            ? comment.likeComment.some(u => u.toString() === currentUserId.toString())
            : false,
        replies: [],
    };

    for (let reply of comment.replies) {
        const replyDoc = await Comment.findById(reply._id);
        if (replyDoc) {
            formatted.replies.push(await populateReplies(replyDoc, depth + 1, currentUserId));
        }
    }

    return formatted;
}

export const commentPost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user._id;
        const { text } = req.body;

        if (!mongoose.Types.ObjectId.isValid(postId))
            return sendBadRequestResponse(res, "Invalid post Id");

        const post = await Post.findById(postId);
        if (!post)
            return sendBadRequestResponse(res, "No Post found");

        const user = await User.findById(userId);
        if (!user)
            return sendNotFoundResponse(res, "User not found");

        const postOwner = await User.findById(post.user);
        if (postOwner.blockedUsers.includes(userId)) {
            return sendForbiddenResponse(res, "You are blocked by this user.");
        }

        if (!text)
            return sendBadRequestResponse(res, "Comment can not be empty...");

        const comment = await Comment.create({ text, user: userId, post: postId });
        await comment.populate("user", "username profilePic");

        post.comments.push(comment._id);
        await post.save();

        await User.updateOne({ _id: userId }, { $addToSet: { comments: postId } });

        if (post.user.toString() !== userId.toString()) {
            const notification = {
                type: "comment",
                userId,
                userDetails: user,
                postId,
                message: `commented on your post.`,
            };

            const receiverSocketId = getReceiverSocketId(post.user.toString());
            if (receiverSocketId) {
                io.to(receiverSocketId).emit("notification", notification);
            }
        }

        return sendSuccessResponse(res, "Comment added...", {
            ...comment._doc,
            timeAgo: getTimeAgo(comment.createdAt)
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

        const post = await Post.findById(parentComment.post);
        if (!post)
            return sendNotFoundResponse(res, "Post not found");

        const postOwner = await User.findById(post.user);
        if (postOwner.blockedUsers.includes(userId)) {
            return sendForbiddenResponse(res, "You are blocked by this user.");
        }

        const reply = await Comment.create({ text, user: userId, post: parentComment.post, parent: commentId });

        parentComment.replies.push(reply._id);
        await parentComment.save();

        await reply.populate("user", "username profilePic");

        return sendSuccessResponse(res, "Reply added", {
            ...reply._doc,
            timeAgo: getTimeAgo(reply.createdAt)
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
        if (!mongoose.Types.ObjectId.isValid(postId)) return sendBadRequestResponse(res, "Invalid postId");

        const rootComments = await Comment.find({ post: postId, parent: null }).sort({ createdAt: -1 });
        if (!rootComments.length) return res.status(404).json({ message: "No comments yet", success: false });

        const result = [];
        for (let comment of rootComments) {
            result.push(await populateReplies(comment, 0, req.user?._id));
        }

        return sendSuccessResponse(res, "Comment fetched successfully", result);

    } catch (error) {
        console.log(error);
        return ThrowError(res, 500, error.message);
    }
};

export const likeComment = async (req, res) => {
    try {
        const likedUser = req.user._id;
        const commentId = req.params.commentId;

        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ message: "Invalid comment ID", success: false });
        }

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: "Comment not found", success: false });
        }

        const alreadyLiked = comment.likeComment.includes(likedUser);

        if (alreadyLiked) {
            // UNLIKE (pull from both comment and user)
            await Comment.updateOne({ _id: commentId }, { $pull: { likeComment: likedUser } });
            await User.updateOne({ _id: likedUser }, { $pull: { likeComment: commentId } });

            return res.status(200).json({
                type: "unliked",
                message: "Comment unliked",
                success: true
            });
        } else {
            // LIKE (add to both comment and user)
            await Comment.updateOne({ _id: commentId }, { $addToSet: { likeComment: likedUser } });
            await User.updateOne({ _id: likedUser }, { $addToSet: { likeComment: commentId } });

            // Send Notification
            const postOwnerId = comment.user.toString();
            if (postOwnerId !== likedUser.toString()) {
                const user = await User.findById(likedUser).select("username profilePic");

                const notification = {
                    type: "like",
                    userId: likedUser,
                    userDetails: user,
                    commentId,
                    message: `Liked your comment`,
                };

                const postOwnerSocketId = getReceiverSocketId(postOwnerId);
                if (postOwnerSocketId) {
                    io.to(postOwnerSocketId).emit("notification", notification);
                }
            }

            return res.status(200).json({
                type: "liked",
                message: "Comment liked",
                success: true
            });
        }
    } catch (error) {
        console.error("Error liking/unliking comment:", error);
        return res.status(500).json({ message: "Something went wrong", success: false });
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


export const toggleBlockUser = async (req, res) => {
    try {
        const blockerId = req.user._id;
        const { targetUserId } = req.params;

        if (!targetUserId) {
            return sendBadRequestResponse(res, "Target user ID is required.");
        }

        if (!blockerId) {
            return sendBadRequestResponse(res, "Invalid logged-in user.");
        }

        if (blockerId.toString() === targetUserId.toString()) {
            return sendBadRequestResponse(res, "You cannot block yourself.");
        }

        const blocker = await User.findById(blockerId);
        if (!blocker) {
            return sendBadRequestResponse(res, "Blocker user not found.");
        }

        const isBlocked = blocker.blockedUsers.includes(targetUserId);

        if (isBlocked) {
            // Unblock user
            blocker.blockedUsers = blocker.blockedUsers.filter(
                id => id.toString() !== targetUserId
            );
            await blocker.save();
            return sendSuccessResponse(res, "User unblocked successfully.");
        } else {
            // Block user
            blocker.blockedUsers.push(targetUserId);

            // Optionally: remove follow/follower relationships
            await User.updateOne({ _id: blockerId }, {
                $pull: { followers: targetUserId, followings: targetUserId }
            });
            await User.updateOne({ _id: targetUserId }, {
                $pull: { followers: blockerId, followings: blockerId }
            });

            await blocker.save();
            return sendSuccessResponse(res, "User blocked successfully.");
        }
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
}
