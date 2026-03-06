import express from "express";
import { uploadPostMedia } from "../../middleware/multerPostUpload.js";
import { createPost, getUserPosts, getSinglePost ,deletePost} from "../../controllers/content/post.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();
router.post(
    "/posts",
    protect,
    uploadPostMedia.array("media", 10),
    createPost
);

router.get(
    "/user/:userId/posts",
    protect,
    getUserPosts
);

router.get(
    "/posts/:postId",
    protect,
    getSinglePost
);

router.delete(
    "/posts/:postId",
    protect,
    deletePost
);
export default router;