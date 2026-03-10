import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    role: {
        type: String,
        enum: ["member", "admin"],
        default: "member"
    },

    joinedAt: {
        type: Date,
        default: Date.now
    }

}, { _id: false });

const threadSchema = new mongoose.Schema({

    participants: {
        type: [participantSchema],
        validate: v => v.length >= 2
    },

    type: {
        type: String,
        enum: ["dm", "group"],
        default: "dm"
    },

    //Prevent duplicate DM threads Only used when type = dm
    dmKey: {
        type: String,
        unique: true,
        sparse: true
    },

    lastMessage: {

        messageId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        },

        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        content: {
            type: String
        },

        mediaType: {
            type: String,
            enum: ["image", "video", "audio", "file"]
        },

        createdAt: {
            type: Date
        }

    },

    lastActivity: {
        type: Date,
        default: Date.now,
        index: true
    },

    messageCount: {
        type: Number,
        default: 0
    },


    //Allows "delete chat for me"

    deletedFor: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],


    //   Archiving chats

    isArchived: {
        type: Boolean,
        default: false
    }

}, { timestamps: true });


threadSchema.index({ "participants.userId": 1 });
threadSchema.index({ lastActivity: -1 });

export default mongoose.model("Thread", threadSchema);