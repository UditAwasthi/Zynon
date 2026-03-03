import express from "express";
import {
  signup,
  login,
  refreshTokenController,
  logout,
  logoutAll,
  sendEmailVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

//Public Routes


router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refreshTokenController);
router.post("/logout", logout);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);



//Protected Routes


router.post("/send-email-verification",protect, sendEmailVerification);
router.post("/logout-all", protect, logoutAll);

export default router;