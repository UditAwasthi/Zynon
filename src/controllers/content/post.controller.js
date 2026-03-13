import Post from "../../models/content/post.model.js";
import Like from "../../models/content/like.model.js";
import Comment from "../../models/content/comment.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import cloudinary from "cloudinary";
import mongoose from "mongoose";
import UserProfile from "../../models/userProfile.model.js";
import notificationService from "../../services/notification.service.js"

//Generate Cloudinary Upload Signature

export const generateUploadSignature = asyncHandler(async (req, res) => {

    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
        {
            timestamp,
            folder: "zynon/posts"
        },
        process.env.CLOUDINARY_API_SECRET
    );

    return res.json({
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });
});



// Create Post (metadata only)

export const createPost = asyncHandler(async (req, res) => {

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {

        const userId = req.user.id;
        const { caption, visibility, media } = req.body;

        if (!media || media.length === 0) {
            throw new ApiError(400, "At least one media file is required");
        }

        if (media.length > 10) {
            throw new ApiError(400, "Maximum 10 media files allowed");
        }

        const post = await Post.create([{
            author: userId,
            caption: caption || "",
            visibility: visibility || "public",
            media
        }], { session });

        await UserProfile.updateOne(
            { user: userId },
            { $inc: { postsCount: 1 } },
            { session }
        );
        try {
            notificationService.sendNewPostNotification({
                actorId: req.user.id,
                postId: post._id
            });
        } catch (err) {
            console.error("Notification job failed:", err.message);
        }
        return sendSuccess(res, 201, "Post created successfully", post[0]);

    });

    session.endSession();

});


//Get posts for a specific user with pagination
export const getUserPosts = asyncHandler(async (req, res) => {

    const { userId } = req.params;
    const { cursor, limit = 12 } = req.query;

    const query = { author: userId };

    // For pagination, we can use the _id field as a cursor

    if (cursor) {
        query._id = { $lt: cursor };
    }
    const posts = await Post.find(query)
        .sort({ _id: -1 })
        .limit(Number(limit) + 1)
        .select("media caption createdAt likesCount commentsCount visibility");

    const nextCusor = posts.length === Number(limit) + 1 ? posts[posts.length - 1]._id : null;

    return sendSuccess(res, 200, "Posts fetched successfully", { posts, nextCusor });
});

//get single post details
export const getSinglePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const currentUserId = req.user.id;



    const post = await Post.aggregate([

        { $match: { _id: new mongoose.Types.ObjectId(postId) } },

        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author"
            }
        },
        { $unwind: "$author" },

        {
            $lookup: {
                from: "userprofiles",
                localField: "author._id",
                foreignField: "user",
                as: "profile"
            }
        },
        {
            $unwind: {
                path: "$profile",
                preserveNullAndEmptyArrays: true
            }
        },

        {
            $lookup: {
                from: "likes",
                let: { postId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$post", "$$postId"] },
                                    { $eq: ["$user", new mongoose.Types.ObjectId(currentUserId)] }
                                ]
                            }
                        }
                    }
                ],
                as: "liked"
            }
        },

        {
            $addFields: {
                isLiked: { $gt: [{ $size: "$liked" }, 0] }
            }
        },

        {
            $project: {
                postId: "$_id",
                caption: 1,
                media: 1,
                likesCount: 1,
                commentsCount: 1,
                createdAt: 1,
                isLiked: 1,

                author: {
                    _id: "$author._id",
                    username: "$author.username"
                },

                profile: {
                    profilePicture: "$profile.profilePicture",
                    name: "$profile.name"
                }
            }
        }

    ])

    if (!post.length) {
        throw new ApiError(404, "Post not found");
    }



    return sendSuccess(res, 200, "Post fetched successfully", post[0]);



});

//delete post
export const deletePost = asyncHandler(async (req, res) => {

    const { postId } = req.params;
    const userId = req.user.id;

    const session = await mongoose.startSession();

    await session.withTransaction(async () => {

        const post = await Post.findById(postId).session(session);

        if (!post) {
            throw new ApiError(404, "Post not found");
        }

        if (!post.author.equals(userId)) {
            throw new ApiError(403, "You are not allowed to delete this post");
        }


        await Promise.all(
            post.media.map(async (media) => {
                try {

                    const urlParts = media.url.split("/");
                    const fileName = urlParts[urlParts.length - 1];
                    const publicId = "zynon/posts/" + fileName.split(".")[0];

                    await cloudinary.uploader.destroy(publicId);

                } catch (err) {
                    console.log("Media delete failed:", err.message);
                }
            })
        );



        const comments = await Comment.find({ post: postId })
            .select("_id")
            .session(session);

        const commentIds = comments.map(c => c._id);



        await Promise.all([


            Post.deleteOne({ _id: postId }).session(session),

            Comment.deleteMany({ post: postId }).session(session),

            Like.deleteMany({
                targetId: postId,
                targetType: "Post"
            }).session(session),

            Like.deleteMany({
                targetId: { $in: commentIds },
                targetType: "Comment"
            }).session(session),


            UserProfile.updateOne(
                { user: userId, postsCount: { $gt: 0 } },
                { $inc: { postsCount: -1 } }
            ).session(session)

        ]);

    });

    session.endSession();

    return sendSuccess(res, 200, "Post deleted successfully");

});

//toggle like

export const toggleLike = asyncHandler(async (req, res) => {

    const userId = req.user.id;
    const { targetId, targetType } = req.body;

    if (!["Post", "Comment"].includes(targetType)) {
        throw new ApiError(400, "Invalid target type");
    }

    const existing = await Like.findOne({
        user: userId,
        targetId,
        targetType
    });

    // UNLIKE
    if (existing) {

        await existing.deleteOne();

        if (targetType === "Post") {
            await Post.findByIdAndUpdate(targetId, { $inc: { likesCount: -1 } });
        }

        if (targetType === "Comment") {
            await Comment.findByIdAndUpdate(targetId, { $inc: { likesCount: -1 } });
        }

        return sendSuccess(res, 200, "Unliked");
    }

    // LIKE
    await Like.create({
        user: userId,
        targetId,
        targetType
    });

    let recipientId;

    if (targetType === "Post") {

        const post = await Post.findByIdAndUpdate(
            targetId,
            { $inc: { likesCount: 1 } },
            { new: true }
        ).select("author");

        recipientId = post.author;

        try {
            notificationService.sendPostLikeNotification({
                actorId: userId,
                recipientId,
                postId: targetId
            });
        } catch (err) {
            console.error("Post like notification failed:", err.message);
        }

    }

    if (targetType === "Comment") {

        const comment = await Comment.findByIdAndUpdate(
            targetId,
            { $inc: { likesCount: 1 } },
            { new: true }
        ).select("author post");

        recipientId = comment.author;

        try {
            notificationService.sendPostCommentNotification({
                actorId: userId,
                recipientId,
                commentId: targetId,
                postId: comment.post
            });
        } catch (err) {
            console.error("Comment like notification failed:", err.message);
        }

    }

    return sendSuccess(res, 200, "Liked");

});
//comment on post

export const createComment = asyncHandler(async (req, res) => {

    const userId = req.user.id;
    const { postId } = req.params;
    const { text, parentComment } = req.body;

    if (!text) {
        throw new ApiError(400, "Comment cannot be empty");
    }

    // get post author for notification
    const post = await Post.findById(postId).select("author");

    if (!post) {
        throw new ApiError(404, "Post not found");
    }

    const comment = await Comment.create({
        author: userId,
        post: postId,
        text,
        parentComment: parentComment || null
    });

    await Post.findByIdAndUpdate(postId, {
        $inc: { commentsCount: 1 }
    });

    if (parentComment) {
        await Comment.findByIdAndUpdate(parentComment, {
            $inc: { repliesCount: 1 }
        });
    }

    // send notification
    try {
        notificationService.sendPostCommentNotification({
            actorId: userId,
            recipientId: post.author,
            commentId: comment._id,
            postId: postId
        });
    } catch (err) {
        console.error("Comment notification failed:", err.message);
    }

    return sendSuccess(res, 201, "Comment added", comment);

});
//get comments for a post with pagination

export const getComments = asyncHandler(async (req, res) => {

    const { postId } = req.params
    const { cursor, limit = 12 } = req.query

    const currentUserId = new mongoose.Types.ObjectId(req.user.id)

    const match = {
        post: new mongoose.Types.ObjectId(postId),
        parentComment: null
    }

    if (cursor) {
        match._id = { $lt: new mongoose.Types.ObjectId(cursor) }
    }

    const comments = await Comment.aggregate([

        { $match: match },

        { $sort: { _id: -1 } },

        { $limit: Number(limit) + 1 },

        /* AUTHOR */

        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author"
            }
        },

        { $unwind: "$author" },

        /* PROFILE */

        {
            $lookup: {
                from: "userprofiles",
                localField: "author._id",
                foreignField: "user",
                as: "profile"
            }
        },

        {
            $unwind: {
                path: "$profile",
                preserveNullAndEmptyArrays: true
            }
        },

        /* CHECK IF USER LIKED COMMENT */

        {
            $lookup: {
                from: "likes",
                let: { commentId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$targetId", "$$commentId"] },
                                    { $eq: ["$targetType", "Comment"] },
                                    { $eq: ["$user", currentUserId] }
                                ]
                            }
                        }
                    }
                ],
                as: "liked"
            }
        },

        {
            $addFields: {
                isLiked: { $gt: [{ $size: "$liked" }, 0] }
            }
        },

        /* PREVIEW FIRST 2 REPLIES */

        {
            $lookup: {
                from: "comments",
                let: { parentId: "$_id" },
                pipeline: [

                    {
                        $match: {
                            $expr: {
                                $eq: ["$parentComment", "$$parentId"]
                            }
                        }
                    },

                    { $sort: { createdAt: 1 } },

                    { $limit: 2 },

                    {
                        $lookup: {
                            from: "users",
                            localField: "author",
                            foreignField: "_id",
                            as: "author"
                        }
                    },

                    { $unwind: "$author" },

                    {
                        $project: {
                            text: 1,
                            createdAt: 1,
                            author: {
                                _id: "$author._id",
                                username: "$author.username"
                            }
                        }
                    }

                ],
                as: "previewReplies"
            }
        },

        {
            $project: {

                commentId: "$_id",
                text: 1,
                createdAt: 1,
                likesCount: 1,
                repliesCount: 1,
                isLiked: 1,
                previewReplies: 1,

                author: {
                    _id: "$author._id",
                    username: "$author.username"
                },

                profile: {
                    profilePicture: "$profile.profilePicture",
                    name: "$profile.name"
                }

            }
        }

    ])

    const nextCursor =
        comments.length > limit
            ? comments[comments.length - 1].commentId
            : null

    return sendSuccess(res, 200, "Comments fetched successfully", {
        comments: comments.slice(0, limit),
        nextCursor
    })

})

//get replies for a comment with pagination
export const getReplies = asyncHandler(async (req, res) => {

    const { commentId } = req.params
    const { cursor, limit = 10 } = req.query

    const currentUserId = new mongoose.Types.ObjectId(req.user.id)

    const match = {
        parentComment: new mongoose.Types.ObjectId(commentId)
    }

    if (cursor) {
        match._id = { $gt: new mongoose.Types.ObjectId(cursor) }
    }

    const replies = await Comment.aggregate([

        { $match: match },

        { $sort: { createdAt: 1 } },

        { $limit: Number(limit) + 1 },

        /* AUTHOR */

        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author"
            }
        },

        { $unwind: "$author" },

        /* PROFILE */

        {
            $lookup: {
                from: "userprofiles",
                localField: "author._id",
                foreignField: "user",
                as: "profile"
            }
        },

        {
            $unwind: {
                path: "$profile",
                preserveNullAndEmptyArrays: true
            }
        },

        /* CHECK IF USER LIKED */

        {
            $lookup: {
                from: "likes",
                let: { commentId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$targetId", "$$commentId"] },
                                    { $eq: ["$targetType", "Comment"] },
                                    { $eq: ["$user", currentUserId] }
                                ]
                            }
                        }
                    }
                ],
                as: "liked"
            }
        },

        {
            $addFields: {
                isLiked: { $gt: [{ $size: "$liked" }, 0] }
            }
        },

        {
            $project: {

                replyId: "$_id",
                text: 1,
                createdAt: 1,
                likesCount: 1,
                isLiked: 1,

                author: {
                    _id: "$author._id",
                    username: "$author.username"
                },

                profile: {
                    profilePicture: "$profile.profilePicture",
                    name: "$profile.name"
                }

            }
        }

    ])

    const nextCursor =
        replies.length > limit
            ? replies[replies.length - 1].replyId
            : null

    return sendSuccess(res, 200, "Replies fetched", {
        replies: replies.slice(0, limit),
        nextCursor
    })

})

//delete comment or reply
export const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const userId = req.user.id


    const session = await mongoose.startSession()


    let deletedReplies = 0;

    await session.withTransaction(async () => {
        const comment = await Comment.findById(commentId).session(session)

        if (!comment) {
            throw new ApiError(404, "Comment not found")
        }

        if (!comment.author.equals(userId)) {
            throw new ApiError(403, "You are not allowed to delete this comment")
        }
        // coutnign replies for quick delete

        deletedReplies = await Comment.countDocuments({ parentComment: commentId }).session(session)

        //delete comment and reply in one go

        await Comment.bulkWrite([
            {
                deleteMany: {
                    filter: { parentComment: commentId }
                }
            },
            {
                deleteOne: {
                    filter: { _id: commentId }
                }
            }
        ], { session })

        //update post's comments count removing deleted comment and its replies 

        await Post.updateOne(
            { _id: comment.post },
            { $inc: { commentsCount: -(1 + deletedReplies) } },
            { session }
        )

        // if its a reply then update parent comment's replies count
        if (comment.parentComment) {
            await Comment.updateOne(
                { _id: comment.parentComment },
                { $inc: { repliesCount: -1 } },
                { session }
            )
        }
    })

    session.endSession()

    return sendSuccess(res, 200, "Comment and its replies deleted successfully")

});


//Edit Comment or Reply
export const editComment = asyncHandler(async (req, res) => {

    const { commentId } = req.params
    const { text } = req.body
    const userId = req.user.id

    if (!text || !text.trim()) {
        throw new ApiError(400, "Comment text cannot be empty")
    }

    const comment = await Comment.findById(commentId)

    if (!comment) {
        throw new ApiError(404, "Comment not found")
    }

    if (!comment.author.equals(userId)) {
        throw new ApiError(403, "You are not allowed to edit this comment")
    }

    await Comment.updateOne(
        { _id: commentId },
        {
            $set: {
                text: text.trim(),
                isEdited: true
            }
        }
    )

    const updatedComment = await Comment.findById(commentId)
        .populate("author", "username")

    return sendSuccess(res, 200, "Comment updated successfully", updatedComment)

})
