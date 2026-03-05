import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getMyProfile,
  updateProfile,
  getProfileByUsername,
  removeProfilePhoto
} from "../controllers/profile.controller.js";
import { upload } from "../middleware/upload.middleware.js";
import { updateProfilePhoto } from "../controllers/profile.controller.js";

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.patch("/me", protect, updateProfile);
router.get("/:username", getProfileByUsername);

router.patch(
    "/photo",
    protect,
    upload.single("profilePicture"),
    updateProfilePhoto
);
router.delete("/photo", protect, removeProfilePhoto);

export default router;