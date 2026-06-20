import express from "express";
import { upload, convertJfifToJpeg, uploadToS3Middleware } from "../middlewares/imageupload.js";
import { listAllS3Images, deleteFromS3 } from "../utils/uploadS3.js";
import { sendSuccessResponse, sendErrorResponse, sendBadRequestResponse } from "../utils/ResponseUtils.js";
import { isAdmin, isUser, UserAuth } from "../middlewares/auth.js";
import { deleteUser, editProfile, editUser, followOrUnfollow, getAllUsers, getUserById, register, searchUsers, suggestedUsers, getUserProfile, getFollowersList, getFollowingList, getFollowRequests, acceptFollowRequest, rejectFollowRequest, searchFollowersAndFollowing } from "../controllers/userController.js";
import { changePassword, forgotPassword, googleAuth, resetPassword, userLogin, VerifyOtp, VerifyPhone } from "../controllers/loginController.js";
import { addTermsOfServices, deleteTermsOfServices, getAllTermsOfServices, getTermsOfServicesById, updateTermsOfServices } from "../controllers/termsOfServicesController.js";
import { addPrivacyPolicy, deletePrivacyPolicy, getAllPrivacyPolicy, getPrivacyPolicyById, updatePrivacyPolicy } from "../controllers/privacyPolicyController.js";
import { addHelpSupport, deleteHelpSupport, getAllHelpSupport, getHelpSupportById, updateHelpSupport } from "../controllers/helpSupportController.js";
import { addReportCategory, deleteReportCategory, getAllReportCategory, getReportCategoryById, updateReportCategory } from "../controllers/reportCategoryController.js";
import { addReport, deleteReport, getAllReports, getReportById, getReportByUserId, updateReport, getReportByReportCategoryId } from "../controllers/reportController.js";
import { addRestrictCategory, deleteRestrictCategory, getAllRestrictCategory, getRestrictCategoryById, updateRestrictCategory } from "../controllers/restrictCategoryController.js";
import { addRestrict, deleteRestrict, getAllRestricts, getRestrictById, getRestrictByUserId, updateRestrict, getRestrictByRestrictCategoryId } from "../controllers/restrictController.js";
import { addAudio, deleteAudio, getAllAudio, getAudioByCategoryId, getAudioById, updateAudio, toggleSaveAudio, getSavedAudios, getTrendingAudios, importAudio, getOriginalAudios, deleteOriginalAudio } from "../controllers/audioController.js";
import { addNewPost, commentPost, deleteComment, deletePost, deleteReplyComment, getAllPost, getAudioIdByPosts, getCommentOfPost, getDrafts, getFollowingUsersPosts, getFriendsProfile, getLikedPostsByUser, getLikeOfPost, getPostsByUserId, getSavedPosts, getTaggedPosts, getUserPost, likeComment, publishDraft, removeDraft, replyComment, savePost, toggleBlockUser, toggleLikePost, updateComment, updatePost, verifyPostOwnership, toggleNotInterestedPost, toggleHidePost, getHiddenPosts } from "../controllers/postController.js";
import { addAudioCategory, deleteAudioCategory, getAllAudioCategory, getAudioCategoryById, updateAudioCategory } from "../controllers/audioCategoryController.js";
import { addPostReportCategory, deletePostReportCategory, getAllPostReportCategory, getPostReportCategoryById, updatePostReportCategory } from "../controllers/postReportCategoryController.js";
import { addPostReport, getAllPostReports, getPostReportById, getPostReportsByPostId, deletePostReport } from "../controllers/postReportController.js";


const indexRoutes = express.Router()

//register Routes
indexRoutes.post("/register", register)
indexRoutes.get("/getAllUsers", UserAuth, isAdmin, getAllUsers)
indexRoutes.get("/getUserById/:id", getUserById)
indexRoutes.get("/getUserProfile/:id", UserAuth, getUserProfile)
indexRoutes.put("/editUser/:id", UserAuth, isAdmin, upload.single("profilePic"), uploadToS3Middleware, editUser)
indexRoutes.put("/editProfile/:id", UserAuth, upload.single("profilePic"), uploadToS3Middleware, editProfile)
indexRoutes.delete("/deleteUser/:id", UserAuth, deleteUser)
indexRoutes.get("/getFollowersList/:id", UserAuth, getFollowersList)
indexRoutes.get("/getFollowingList/:id", UserAuth, getFollowingList)

//login Routes
indexRoutes.post("/userLogin", userLogin)
indexRoutes.post("/googleAuth", googleAuth)
indexRoutes.post("/VerifyPhone", VerifyPhone)
indexRoutes.post("/forgotPassword", forgotPassword)
indexRoutes.post("/VerifyEmail", VerifyOtp)
indexRoutes.post("/resetPassword", resetPassword)
indexRoutes.post("/changePassword", UserAuth, changePassword)


//TermsOfServices Routes
indexRoutes.post("/addTermsOfServices", UserAuth, isAdmin, addTermsOfServices)
indexRoutes.get("/getAllTermsOfServices", UserAuth, getAllTermsOfServices)
indexRoutes.get("/getTermsOfServicesById/:id", UserAuth, getTermsOfServicesById)
indexRoutes.put("/updateTermsOfServices/:id", UserAuth, isAdmin, updateTermsOfServices)
indexRoutes.delete("/deleteTermsOfServices/:id", UserAuth, isAdmin, deleteTermsOfServices)

//PrivacyPolicy Routes
indexRoutes.post("/addPrivacyPolicy", UserAuth, isAdmin, addPrivacyPolicy)
indexRoutes.get("/getAllPrivacyPolicy", UserAuth, getAllPrivacyPolicy)
indexRoutes.get("/getPrivacyPolicyById/:id", UserAuth, getPrivacyPolicyById)
indexRoutes.put("/updatePrivacyPolicy/:id", UserAuth, isAdmin, updatePrivacyPolicy)
indexRoutes.delete("/deletePrivacyPolicy/:id", UserAuth, isAdmin, deletePrivacyPolicy)

//HelpSupport Routes
indexRoutes.post("/addHelpSupport", UserAuth, isAdmin, addHelpSupport)
indexRoutes.get("/getAllHelpSupport", UserAuth, getAllHelpSupport)
indexRoutes.get("/getHelpSupportById/:id", UserAuth, getHelpSupportById)
indexRoutes.put("/updateHelpSupport/:id", UserAuth, isAdmin, updateHelpSupport)
indexRoutes.delete("/deleteHelpSupport/:id", UserAuth, isAdmin, deleteHelpSupport)

//ReportCategory Routes
indexRoutes.post("/addReportCategory", UserAuth, isAdmin, addReportCategory)
indexRoutes.get("/getAllReportCategory", UserAuth, getAllReportCategory)
indexRoutes.get("/getReportCategoryById/:id", UserAuth, getReportCategoryById)
indexRoutes.put("/updateReportCategory/:id", UserAuth, isAdmin, updateReportCategory)
indexRoutes.delete("/deleteReportCategory/:id", UserAuth, isAdmin, deleteReportCategory)

//Report Routes
indexRoutes.post("/addReport", UserAuth, isUser, addReport)
indexRoutes.get("/getAllReports", UserAuth, isAdmin, getAllReports)
indexRoutes.get("/getReportById/:id", UserAuth, getReportById)
indexRoutes.get("/getReportByUserId/:id", UserAuth, isAdmin, getReportByUserId)
indexRoutes.get("/getReportByReportCategoryId/:id", UserAuth, getReportByReportCategoryId)
indexRoutes.put("/updateReport/:id", UserAuth, updateReport)
indexRoutes.delete("/deleteReport/:id", UserAuth, isAdmin, deleteReport)

//RestrictCategory Routes
indexRoutes.post("/addRestrictCategory", UserAuth, isAdmin, addRestrictCategory)
indexRoutes.get("/getAllRestrictCategory", UserAuth, getAllRestrictCategory)
indexRoutes.get("/getRestrictCategoryById/:id", UserAuth, getRestrictCategoryById)
indexRoutes.put("/updateRestrictCategory/:id", UserAuth, isAdmin, updateRestrictCategory)
indexRoutes.delete("/deleteRestrictCategory/:id", UserAuth, isAdmin, deleteRestrictCategory)

//Restrict Routes
indexRoutes.post("/addRestrict", UserAuth, isUser, addRestrict)
indexRoutes.get("/getAllRestricts", UserAuth, isAdmin, getAllRestricts)
indexRoutes.get("/getRestrictById/:id", UserAuth, getRestrictById)
indexRoutes.get("/getRestrictByUserId/:id", UserAuth, isAdmin, getRestrictByUserId)
indexRoutes.get("/getRestrictByRestrictCategoryId/:id", UserAuth, getRestrictByRestrictCategoryId)
indexRoutes.put("/updateRestrict/:id", UserAuth, updateRestrict)
indexRoutes.delete("/deleteRestrict/:id", UserAuth, isAdmin, deleteRestrict)

//AudioCategory Routes
indexRoutes.post("/addAudioCategory", UserAuth, isAdmin, addAudioCategory)
indexRoutes.get("/getAllAudioCategory", UserAuth, getAllAudioCategory)
indexRoutes.get("/getAudioCategoryById/:id", UserAuth, getAudioCategoryById)
indexRoutes.put("/updateAudioCategory/:id", UserAuth, isAdmin, updateAudioCategory)
indexRoutes.delete("/deleteAudioCategory/:id", UserAuth, isAdmin, deleteAudioCategory)

//Audio Routes
indexRoutes.post("/addAudio", UserAuth, isAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'audio_image', maxCount: 1 }]), uploadToS3Middleware, addAudio)
indexRoutes.get("/getAllAudio", UserAuth, getAllAudio)
indexRoutes.get("/getAudioById/:id", UserAuth, getAudioById)
indexRoutes.get("/getAudioByCategoryId/:id", UserAuth, getAudioByCategoryId)
indexRoutes.post("/toggleSaveAudio/:id", UserAuth, toggleSaveAudio)
indexRoutes.get("/getSavedAudios", UserAuth, getSavedAudios)
indexRoutes.get("/getTrendingAudios", UserAuth, getTrendingAudios)
indexRoutes.post("/addOriginalAudio", UserAuth, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'audio_image', maxCount: 1 }]), uploadToS3Middleware, importAudio)
indexRoutes.get("/getOriginalAudios", UserAuth, getOriginalAudios)
indexRoutes.delete("/deleteOriginalAudio/:id", UserAuth, deleteOriginalAudio)
indexRoutes.put("/updateAudio/:id", UserAuth, isAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'audio_image', maxCount: 1 }]), uploadToS3Middleware, updateAudio)
indexRoutes.delete("/deleteAudio/:id", UserAuth, isAdmin, deleteAudio)

//post Routes
indexRoutes.post("/addNewPost", UserAuth, isUser, upload.fields([{ name: 'post_video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), uploadToS3Middleware, addNewPost)
indexRoutes.get("/getAllPost", getAllPost)
indexRoutes.get("/getPostsByUserId/:userId", UserAuth, getPostsByUserId)
indexRoutes.get("/getUserPost", UserAuth, getUserPost)
indexRoutes.get("/getFriendsProfile", UserAuth, getFriendsProfile)
indexRoutes.get("/getFollowingUsersPosts", UserAuth, getFollowingUsersPosts)
indexRoutes.get("/getAudioIdByPosts/:audioId", UserAuth, getAudioIdByPosts)
indexRoutes.put("/updatePost/:postId", UserAuth, isUser, verifyPostOwnership, upload.fields([{ name: 'post_video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), uploadToS3Middleware, updatePost)
indexRoutes.delete("/deletePost/:postId", UserAuth, deletePost)
indexRoutes.post("/savePost/:id", UserAuth, savePost)
indexRoutes.get("/getSavedPosts", UserAuth, getSavedPosts)
indexRoutes.post("/notInterestedPost/:id", UserAuth, toggleNotInterestedPost)
indexRoutes.post("/hidePost/:id", UserAuth, toggleHidePost)
indexRoutes.get("/getHidePost", UserAuth, getHiddenPosts)

indexRoutes.get("/searchUsers", UserAuth, searchUsers)
indexRoutes.get("/searchFollowersAndFollowing", UserAuth, isUser, searchFollowersAndFollowing)
indexRoutes.get("/suggestedUsers", UserAuth, isUser, suggestedUsers)
indexRoutes.post("/followOrUnfollow/:id", UserAuth, isUser, followOrUnfollow)
indexRoutes.get("/getFollowRequests", UserAuth, isUser, getFollowRequests)
indexRoutes.post("/acceptFollowRequest/:id", UserAuth, isUser, acceptFollowRequest)
indexRoutes.post("/rejectFollowRequest/:id", UserAuth, isUser, rejectFollowRequest)
indexRoutes.get("/getTaggedPosts", UserAuth, getTaggedPosts)
indexRoutes.post("/toggleBlockUser/:targetUserId", UserAuth, toggleBlockUser)

indexRoutes.post("/publishDraft/:postId", UserAuth, publishDraft)
indexRoutes.post("/removeDraft/:postId", UserAuth, removeDraft)
indexRoutes.get("/getDrafts", UserAuth, getDrafts)

indexRoutes.post("/toggleLikePost/:id", UserAuth, toggleLikePost)
indexRoutes.get("/getLikeOfPost/:id", UserAuth, getLikeOfPost)
indexRoutes.get("/getLikedPostsByUser", UserAuth, getLikedPostsByUser)

indexRoutes.post("/commentPost/:id", UserAuth, commentPost)
indexRoutes.post("/replyComment/:commentId", UserAuth, replyComment)
indexRoutes.delete("/deleteReplyComment/:replyId", UserAuth, deleteReplyComment)
indexRoutes.get("/getCommentOfPost/:id", UserAuth, getCommentOfPost)
indexRoutes.post("/likeComment/:commentId", UserAuth, likeComment)
indexRoutes.put("/updateComment/:commentId", UserAuth, updateComment)
indexRoutes.delete("/deleteComment/:commentId", UserAuth, deleteComment)

//postReportCategory
indexRoutes.post("/addPostReportCategory", UserAuth, isAdmin, addPostReportCategory)
indexRoutes.get("/getAllPostReportCategory", UserAuth, getAllPostReportCategory)
indexRoutes.get("/getPostReportCategoryById/:id", UserAuth, getPostReportCategoryById)
indexRoutes.put("/updatePostReportCategory/:id", UserAuth, isAdmin, updatePostReportCategory)
indexRoutes.delete("/deletePostReportCategory/:id", UserAuth, isAdmin, deletePostReportCategory)

//postReport
indexRoutes.post("/addPostReport", UserAuth, isUser, addPostReport)
indexRoutes.get("/getAllPostReports", UserAuth, isAdmin, getAllPostReports)
indexRoutes.get("/getPostReportById/:id", UserAuth, getPostReportById)
indexRoutes.get("/getPostReportsByPostId/:postId", UserAuth, getPostReportsByPostId)
indexRoutes.delete("/deletePostReport/:id", UserAuth, isAdmin, deletePostReport)



indexRoutes.get("/s3/list", async (req, res) => {
    try {
        const allUrls = await listAllS3Images();
        return sendSuccessResponse(res, "S3 images listed successfully", { total: allUrls.length, images: allUrls });
    } catch (error) {
        console.error("List S3 Images Error:", error);
        return sendErrorResponse(res, 500, "Failed to list S3 images: " + error.message);
    }
});

indexRoutes.delete("/s3/delete", async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) {
        return sendBadRequestResponse(res, "Image URL is required");
    }
    try {
        const key = imageUrl.split(".amazonaws.com/")[1];
        if (!key) return sendBadRequestResponse(res, "Invalid S3 URL");
        await deleteFromS3(key);
        return sendSuccessResponse(res, "Image deleted successfully from S3", { imageUrl });
    }
    catch (error) {
        console.error("Delete S3 Image Error:", error);
        return sendErrorResponse(res, 500, "Failed to delete image from S3: " + error.message);
    }
});

indexRoutes.delete("/s3/delete-multiple", async (req, res) => {
    try {
        const { images } = req.body;

        if (!Array.isArray(images) || images.length === 0) {
            return sendBadRequestResponse(res, "Images array is required");
        }

        const keys = images
            .map(url => {
                const key = url.split(".amazonaws.com/")[1];
                return key || null;
            })
            .filter(Boolean);

        if (keys.length === 0) {
            return sendBadRequestResponse(res, "No valid S3 keys found in images array");
        }

        const results = await Promise.allSettled(keys.map((key) => deleteFromS3(key)));

        const success = [];
        const failed = [];

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                success.push(keys[index]);
            } else {
                failed.push({ key: keys[index], reason: result.reason.message });
            }
        });

        return sendSuccessResponse(res, "S3 images deletion completed", { success, failed });
    } catch (error) {
        console.error("deleteMultipleImages Error:", error);
        return sendErrorResponse(res, 500, "Failed to delete images: " + error.message);
    }
});

export default indexRoutes

