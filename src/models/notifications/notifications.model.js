import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true 
        },
        type: {
            type: String,
            enum: [
                "NEW_MESSAGE",
                "NEW_POST",
                "FOLLOW",
                "FOLLOW_REQUEST",
                "FOLLOW_ACCEPTED",
                "POST_LIKE",
                "POST_COMMENT",
                "COMMENT_LIKE",
                "MENTION"
            ],
            required: true,
            index: true
        },

        entityId: {
            type: mongoose.Schema.Types.ObjectId
        },

        entityType: {
            type: String,
            enum: [
                "message",
                "post",
                "comment",
                "follow",
                "user"
            ]
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed
        },

        read: {
            type: Boolean,
            default: false,
            index: true
        },

        
        // lets the frontend show "Accepted" / "Rejected" instead of buttons on refresh
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending"
        }
    }, {
    timestamps: true
}
);

notificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);