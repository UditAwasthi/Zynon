import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
    url:  { type: String, required: true },
    type: {
        type: String,
        enum: ["image", "video", "audio", "file"],
        required: true
    },
    meta: {
        width:    Number,
        height:   Number,
        duration: Number,
        size:     Number
    }
}, { _id: false });


const messageSchema = new mongoose.Schema({

    threadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Thread",
        required: true,
        index: true
    },

    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    type: {
        type: String,
        enum: ["text", "media", "post", "system", "forward"],
        default: "text"
    },

    content: {
        type: String,
        trim: true
    },

    // Shared post reference
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Post"
    },

    attachments: [attachmentSchema],

    // Reply-to reference
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
    },

    // Forward metadata
    forwardedFrom: {
        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },

    // Pin metadata (stored on message for quick lookup)
    pinnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    pinnedAt: Date,

    // Read / delivery receipts
    seenBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    deliveredTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    // Reactions
    reactions: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        emoji: {
            type: String,
            required: true
        }
    }],

    // Edit tracking
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date,

    // Soft delete — content is wiped but the record is kept for thread integrity
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: Date

}, { timestamps: true });


// Pre-validate: ensure non-deleted messages have at least one content field
messageSchema.pre("validate", function () {

    if (this.isDeleted) return; // Soft-deleted messages don't need content

    if (
        !this.content &&
        !this.postId &&
        (!this.attachments || this.attachments.length === 0)
    ) {
        const err = new Error("Message must contain text, attachment, or post");
        err.statusCode = 400;
        throw err;
    }
});


// Compound index for paginated message fetch (most common query)
messageSchema.index({ threadId: 1, createdAt: -1 });

// Full-text search index on content
messageSchema.index({ content: "text" });

export default mongoose.model("Message", messageSchema);