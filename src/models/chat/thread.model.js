import mongoose from "mongoose";

const participantSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  role: {
    type: String,
    enum: ["member", "admin", "owner"],
    default: "member"
  },

  joinedAt: {
    type: Date,
    default: Date.now
  }

}, { _id: false });


const permissionsSchema = new mongoose.Schema({

  sendMessages: {
    type: Boolean,
    default: true
  },

  addMembers: {
    type: Boolean,
    default: true
  },

  removeMembers: {
    type: Boolean,
    default: false
  },

  changeGroupInfo: {
    type: Boolean,
    default: false
  },

  pinMessages: {
    type: Boolean,
    default: true
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

  // group info
  name: String,

  avatar: String,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  // permissions
  permissions: {
    type: permissionsSchema,
    default: () => ({})
  },

  // pinned messages
  pinnedMessages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  }],

  // prevent duplicate DM
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

    content: String,

    mediaType: {
      type: String,
      enum: ["image", "video", "audio", "file"]
    },

    createdAt: Date
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

  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  isArchived: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });


threadSchema.index({ "participants.userId": 1 });
threadSchema.index({ lastActivity: -1 });

export default mongoose.model("Thread", threadSchema);