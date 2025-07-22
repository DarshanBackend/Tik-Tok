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

        return res.status(200).json({
            posts,
            success: true,
        });
    } catch (error) {
        console.log(error);
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
            // const notification = {
            //   type: "comment",
            //   message: `${comment.author.username} commented on your post.`,
            //   senderId: userId,
            //   receiverId: post.author._id.toString(),
            //   postId,
            //   timestamp: new Date(),
            // };

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

        if (!comments) {
            return res.status(404).json({
                message: "No comments yet",
                success: false,
            });
        }

        return res.status(200).json({
            success: true,
            comments,
        });
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

        if (post.status === 'published') {
            return sendBadRequestResponse(res, 'This post has already been published.');
        }

        post.status = 'draft';
        await post.save();

        return sendSuccessResponse(res, 'Draft published successfully.', post);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

export const getDrafts = async (req, res) => {
    try {
        const userId = req.user._id;
        const drafts = await Post.find({ user: userId, status: 'draft' }).populate('user', '-password');
        return sendSuccessResponse(res, 'Drafts fetched successfully.', drafts);
    } catch (error) {
        return sendErrorResponse(res, 500, error.message);
    }
};

