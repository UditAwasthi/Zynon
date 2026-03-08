import mongoose from "mongoose";


const CommentSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post",
        required: true,
        index: true
    },
    text: {
        type: String,
        maxlength: 1000,
        required: true
    },
    parentComment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
        default: null,
        index: true
    },
    likesCount: {
        type: Number,
        default: 0
    },
    repliesCount: {
        type: Number,
        default: 0
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

CommentSchema.index({ post: 1, parentComment: 1, createdAt: -1 })
CommentSchema.index({ parentComment: 1, createdAt: 1 })

export default mongoose.model("Comment", CommentSchema);