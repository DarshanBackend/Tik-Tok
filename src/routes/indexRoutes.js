import express from "express";
import { upload, convertJfifToJpeg } from "../middlewares/imageupload.js";
import { isAdmin, isUser, UserAuth } from "../middlewares/auth.js";
import { deleteUser, editProfile, editUser, getAllUsers, getUserById, register } from "../controllers/userController.js";
import { changePassword, forgotPassword, resetPassword, userLogin, VerifyOtp, VerifyPhone } from "../controllers/loginController.js";
import { addTermsOfServices, deleteTermsOfServices, getAllTermsOfServices, getTermsOfServicesById, updateTermsOfServices } from "../controllers/termsOfServicesController.js";
import { addPrivacyPolicy, deletePrivacyPolicy, getAllPrivacyPolicy, getPrivacyPolicyById, updatePrivacyPolicy } from "../controllers/privacyPolicyController.js";
import { addHelpSupport, deleteHelpSupport, getAllHelpSupport, getHelpSupportById, updateHelpSupport } from "../controllers/helpSupportController.js";
import { addReportCategory, deleteReportCategory, getAllReportCategory, getReportCategoryById, updateReportCategory } from "../controllers/reportCategoryController.js";
import { addReport, deleteReport, getAllReports, getReportById, getReportByUserId, updateReport } from "../controllers/reportController.js";
import { addAudio, deleteAudio, getAllAudio, getAudioById, updateAudio } from "../controllers/audioController.js";


const indexRoutes = express.Router()

//register Routes
indexRoutes.post("/register", register)
indexRoutes.get("/getAllUsers", UserAuth, isAdmin, getAllUsers)
indexRoutes.get("/getUserById/:id", UserAuth, isAdmin, getUserById)
indexRoutes.put("/editUser/:id", UserAuth, isAdmin, upload.single("profilePic"), convertJfifToJpeg, editUser)
indexRoutes.put("/editProfile/:id", UserAuth, upload.single("profilePic"), convertJfifToJpeg, editProfile)
indexRoutes.delete("/deleteUser/:id", UserAuth, deleteUser)

//login Routes
indexRoutes.post("/userLogin", userLogin)
indexRoutes.post("/VerifyPhone", VerifyPhone)
indexRoutes.post("/forgotPassword", forgotPassword)
indexRoutes.post("/VerifyEmail", VerifyOtp)
indexRoutes.post("/resetPassword", UserAuth, resetPassword)
indexRoutes.post("/changePassword", UserAuth, changePassword)

//TermsOfServices Routes
indexRoutes.post("/addTermsOfServices", UserAuth, isAdmin, addTermsOfServices)
indexRoutes.get("/getAllTermsOfServices", UserAuth, isAdmin, getAllTermsOfServices)
indexRoutes.get("/getTermsOfServicesById/:id", UserAuth, isAdmin, getTermsOfServicesById)
indexRoutes.put("/updateTermsOfServices/:id", UserAuth, isAdmin, updateTermsOfServices)
indexRoutes.delete("/deleteTermsOfServices/:id", UserAuth, isAdmin, deleteTermsOfServices)

//PrivacyPolicy Routes
indexRoutes.post("/addPrivacyPolicy", UserAuth, isAdmin, addPrivacyPolicy)
indexRoutes.get("/getAllPrivacyPolicy", UserAuth, isAdmin, getAllPrivacyPolicy)
indexRoutes.get("/getPrivacyPolicyById/:id", UserAuth, isAdmin, getPrivacyPolicyById)
indexRoutes.put("/updatePrivacyPolicy/:id", UserAuth, isAdmin, updatePrivacyPolicy)
indexRoutes.delete("/deletePrivacyPolicy/:id", UserAuth, isAdmin, deletePrivacyPolicy)

//HelpSupport Routes
indexRoutes.post("/addHelpSupport", UserAuth, isAdmin, addHelpSupport)
indexRoutes.get("/getAllHelpSupport", UserAuth, isAdmin, getAllHelpSupport)
indexRoutes.get("/getHelpSupportById/:id", UserAuth, isAdmin, getHelpSupportById)
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
indexRoutes.put("/updateReport/:id", UserAuth, isAdmin, updateReport)
indexRoutes.delete("/deleteReport/:id", UserAuth, isAdmin, deleteReport)

//Audio Routes
indexRoutes.post("/addAudio", UserAuth, isAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'audio_image', maxCount: 1 }]), convertJfifToJpeg, addAudio)
indexRoutes.get("/getAllAudio", UserAuth, getAllAudio)
indexRoutes.get("/getAudioById/:id", UserAuth, getAudioById)
indexRoutes.put("/updateAudio/:id", UserAuth, isAdmin, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'audio_image', maxCount: 1 }]), convertJfifToJpeg, updateAudio)
indexRoutes.delete("/deleteAudio/:id", UserAuth, isAdmin, deleteAudio)


export default indexRoutes

