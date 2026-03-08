import Post from "../../models/content/post.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { uploadImage } from "../../utils/uploadToCloudinary.js";
import cloudinary from "cloudinary";
import mongoose from "mongoose";



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

    const userId = req.user.id;
    const { caption, visibility, media } = req.body;

    if (!media || media.length === 0) {
        throw new ApiError(400, "At least one media file is required");
    }

    if (media.length > 10) {
        throw new ApiError(400, "Maximum 10 media files allowed");
    }

    const post = await Post.create({
        author: userId,
        caption: caption || "",
        visibility: visibility || "public",
        media
    });

    return sendSuccess(res, 201, "Post created successfully", post);
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
// export const getSinglePost = asyncHandler(async (req, res) => {
//     const { postId } = req.params;
//     const currentUserId = req.user.id;



//     const post = await Post.aggregate([

//         { $match: { _id: new mongoose.Types.ObjectId(postId) } },
//         {
//             $lookup: {
//                 from: "users",
//                 localField: "author",
//                 foreignField: "_id",
//                 as: "author"
//             }
//         },
//         { $unwind: "$author" },
//         {
//             $project: {
//                 from: "userprofiles",
//                 localField: "author._id",
//                 foreignField: "user",
//                 as: "profile"
//             }
//         },
//         { $unwind: "$profile" },
//         {
//             $lookup: {
//                 from: "likes",
//                 let: { postId: "$_id" },
//                 pipeline: [
//                     {
//                         $match: {
//                             $expr: {
//                                 $and: [
//                                     { $eq: ["$post", "$$postId"] },
//                                     { $eq: ["$user", new mongoose.Types.ObjectId(currentUserId)] }
//                                 ]
//                             }
//                         }
//                     }
//                 ],
//                 as: "liked"
//             }
//         },
//         {
//             $addFields: {
//                 isLiked: { $gt: [{ $size: "$liked" }, 0] }
//             }
//         },

//         {
//             $project: {
//postId: "$_id",
//                 caption: 1,
//                 media: 1,
//                 likesCount: 1,
//                 commentsCount: 1,
//                 createdAt: 1,

//                 isLiked: 1,

//                 author: {
//                     _id: "$author._id",
//                     username: "$author.username"
//                 },

//                 profile: {
//                     profilePicture: "$profile.profilePicture",
//                     name: "$profile.name"
//                 }
//             }
//         }

//     ]);

//     if (!post.length) {
//         throw new ApiError(404, "Post not found");
//     }

//     console.log("Post fetched successfully");

//     return sendSuccess(res, 200, "Post fetched successfully", post[0]);



// });

//temporary get single post details without like status and author profile
export const getSinglePost = asyncHandler(async (req, res) => {

    const { postId } = req.params;


    const post = await Post.aggregate([

        {
            $match: {
                _id: new mongoose.Types.ObjectId(postId)
            }
        },

        // author info
        {
            $lookup: {
                from: "users",
                localField: "author",
                foreignField: "_id",
                as: "author"
            }
        },
        { $unwind: "$author" },

        // profile info
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
            $project: {
                postId: "$_id",
                caption: 1,
                media: 1,
                likesCount: 1,
                commentsCount: 1,
                createdAt: 1,

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

    ]);

    if (!post.length) {
        throw new ApiError(404, "Post not found");
    }

    return sendSuccess(res, 200, "Post fetched successfully", post[0]);

});

//delete post
export const deletePost = asyncHandler(async (req, res) => {

    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) {
        throw new ApiError(404, "Post not found");
    }

    if (!post.author.equals(userId)) {
        throw new ApiError(403, "You are not allowed to delete this post");
    }

    // delete post immediately
    await Post.deleteOne({ _id: postId });

    // background media deletion
    post.media.forEach(media => {

        try {

            const urlParts = media.url.split("/");
            const fileName = urlParts[urlParts.length - 1];
            const publicId = "zynon/profile_photos/" + fileName.split(".")[0];

            cloudinary.uploader.destroy(publicId).catch(() => { });

        } catch (_) { }

    });

    return sendSuccess(res, 200, "Post deleted successfully");

});