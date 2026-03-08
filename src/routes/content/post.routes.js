import express from "express";

import { createPost, getUserPosts, getSinglePost ,deletePost,generateUploadSignature} from "../../controllers/content/post.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.get(
    "/media/signature",
    protect,
    generateUploadSignature
);

router.post(
    "/posts",
    protect,
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