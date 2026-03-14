import Post from "../../models/content/post.model.js"
import mongoose from "mongoose";

const PAGE_SIZE = 15;

//Home feed only following 
export const fetchHomeFeed = async (followingIds, cursor) => {

    const query = {
        author: { $in: followingIds }
    };

    if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const posts = await Post.find(query)
        .sort({ _id: -1 })
        .limit(PAGE_SIZE)
        .populate("author", "username")
        .lean();

    return posts;
};


//reels 

export const fetchReelsFeed = async (cursor) => {

    const query = {
        visibility: "public",
        "media.type": "video",
        $expr: {
            $gt: [
                { $arrayElemAt: ["$media.height", 0] },
                { $arrayElemAt: ["$media.width", 0] }
            ]
        }
    };

    if (cursor) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const reels = await Post.find(query)
        .sort({ _id: -1 })
        .limit(PAGE_SIZE)
        .populate("author", "username")
        .lean();

    const nextCursor =
        reels.length === PAGE_SIZE
            ? reels[reels.length - 1]._id
            : null;

    return {
        reels,
        nextCursor
    };
};

//explore

export const fetchExploreFeed = async (cursor) => {

    const matchStage = {
        visibility: "public"
    };

    if (cursor) {
        matchStage._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const posts = await Post.aggregate([
        { $match: matchStage },

        {
            $addFields: {
                hoursSincePost: {
                    $divide: [
                        { $subtract: [new Date(), "$createdAt"] },
                        1000 * 60 * 60
                    ]
                }
            }
        },

        {
            $addFields: {
                engagementScore: {
                    $add: [
                        { $multiply: ["$likesCount", 2] },
                        { $multiply: ["$commentsCount", 3] }
                    ]
                }
            }
        },

        {
            $addFields: {
                score: {
                    $divide: [
                        "$engagementScore",
                        { $add: ["$hoursSincePost", 2] }
                    ]
                }
            }
        },

        { $sort: { score: -1 } },

        { $limit: PAGE_SIZE }
    ]);

    return posts;
};