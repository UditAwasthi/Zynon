import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  url: String,

  type: {
    type: String,
    enum: ["image", "video", "audio", "file"]
  },

  meta: {
    width: Number,
    height: Number,
    duration: Number,
    size: Number
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
    enum: [
      "text",
      "media",
      "post",
      "system",
      "forward"
    ],
    default: "text"
  },

  content: {
    type: String,
    trim: true,
    index: true
  },

  // post share
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post"
  },

  attachments: [attachmentSchema],

  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },

  // forward message
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

  // pin support
  pinnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  pinnedAt: Date,

  seenBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  deliveredTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    emoji: String
  }],

  isEdited: {
    type: Boolean,
    default: false
  },

  editedAt: Date,

  isDeleted: {
    type: Boolean,
    default: false
  },

  deletedAt: Date

}, { timestamps: true });


// validation
messageSchema.pre("validate", function () {

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


messageSchema.index({ threadId: 1, createdAt: -1 });
messageSchema.index({ content: "text" }); // message search

export default mongoose.model("Message", messageSchema);