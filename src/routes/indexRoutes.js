import express from "express";
import { upload, convertJfifToJpeg } from "../middlewares/imageupload.js";
import { isAdmin, isUser, UserAuth } from "../middlewares/auth.js";
import { editProfile, editUser, getAllUsers, getUserById, register } from "../controllers/userController.js";


const indexRoutes = express.Router()

indexRoutes.post("/register", register)
indexRoutes.get("/getAllUsers", UserAuth, isAdmin, getAllUsers)
indexRoutes.get("/getUserById", UserAuth, isAdmin, getUserById)
indexRoutes.put("/editUser", UserAuth, isAdmin, upload.single("profilePic"), convertJfifToJpeg, editUser)
indexRoutes.put("/editProfile", UserAuth, isUser, upload.single("profilePic"), convertJfifToJpeg, editProfile)




export default indexRoutes

