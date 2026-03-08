import express from "express";

import { createPost, getUserPosts, getSinglePost, deletePost, generateUploadSignature, toggleLike, createComment, getComments, getReplies,deleteComment,editComment } from "../../controllers/content/post.controller.js";
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
router.post(
    "/posts/likes/toggle",
    protect,
    toggleLike)

router.post(
    "/posts/:postId/comments",
    protect,
    createComment
);

router.get(
    "/posts/:postId/comments",
    protect,
    getComments
);
router.get(
    "/comments/:commentId/replies",
    protect,
    getReplies)
router.delete(
  "/comments/:commentId",
  protect,
  deleteComment
)
router.patch(
  "/comments/:commentId",
  protect,
  editComment
)
export default router;