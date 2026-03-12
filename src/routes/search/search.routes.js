import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { search,searchUserSuggestions } from "../../controllers/search/search.controller.js";


const router = express.Router();
router.get("/", search);
router.get("/suggestions", searchUserSuggestions)
export default router;