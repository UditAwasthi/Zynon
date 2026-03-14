import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema({
    url: { type: String, required: true },

    type: {
        type: String,
        enum: ["image", "video"],
        required: true
    },

    width: Number,
    height: Number,
    duration: Number
},
    { id: false }
);


const PostSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    caption: {
        type: String,
        maxlength: 2200
    },
    media: {
        type: [MediaSchema],
        validate: [
            {
                validator: function (value) {
                    return value.length > 0;
                },
                message: "A post must have at least one media item."
            },
            {
                validator: function (value) {
                    return value.length <= 10;
                },
                message: "A post can have at most 10 media items."
            }
        ]
    },
    likesCount: {
        type: Number,
        default: 0
    },
    commentsCount: {
        type: Number,
        default: 0
    },
    visibility: {
        type: String,
        enum: ["public", "followers"],
        default: "public"
    },
},
    { timestamps: true }
);

PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 })
PostSchema.index({ likesCount: -1 });
PostSchema.index({ commentsCount: -1 });
export default mongoose.model("Post", PostSchema);