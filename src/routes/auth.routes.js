import express from "express";
import {
  signup,
  login,
  refreshTokenController,
  logout,
  logoutAll,
} from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

//Public Routes


router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refreshTokenController);

//Protected Routes


router.post("/logout", logout);
router.post("/logout-all", protect, logoutAll);

export default router;