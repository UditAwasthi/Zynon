import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getMyProfile,
  updateProfile,
  getProfileByUsername
} from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.patch("/me", protect, updateProfile);
router.get("/:username", getProfileByUsername);

export default router;