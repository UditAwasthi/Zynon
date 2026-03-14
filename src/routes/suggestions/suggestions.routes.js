import express from "express";
import {getUserSuggestions} from "../../controllers/suggestions/suggestions.controller.js"

import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();


router.get("/users-to-follow", protect, getUserSuggestions);


export default router;