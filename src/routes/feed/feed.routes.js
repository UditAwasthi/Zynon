import express from "express";
import {
  getHomeFeed,
  getReelsFeed,
  getExploreFeed
} from "../../controllers/feed/feed.controller.js";

import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();


router.get("/home", protect, getHomeFeed);

router.get("/reels", protect, getReelsFeed);

router.get("/explore", getExploreFeed);

export default router;