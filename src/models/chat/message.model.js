import mongoose from "mongoose";

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
    enum: ["text", "media", "system"],
    default: "text"
  },

  content: {
    type: String,
    trim: true
  },

  mediaUrl: {
    type: String
  },

  mediaType: {
    type: String,
    enum: ["image", "video", "audio", "file"]
  },

  mediaMeta: {
    width: Number,
    height: Number,
    duration: Number,
    size: Number
  },

  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },

  seenBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  isEdited: {
    type: Boolean,
    default: false
  },

  editedAt: {
    type: Date
  },

  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedAt: {
    type: Date
  }

}, { timestamps: true });

messageSchema.pre("validate", function () {
  if (!this.content && !this.mediaUrl) {
    const err = new Error("Message must contain text or media");
    err.statusCode = 400;
    throw err;
  }
});

messageSchema.index({ threadId: 1, createdAt: -1 });


export default mongoose.model("Message", messageSchema);