import mongoose from "mongoose";

const LikeSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },

  targetType: {
    type: String,
    enum: ["Post", "Comment"],
    required: true
  }

}, { timestamps: true });

LikeSchema.index(
  { user: 1, targetId: 1, targetType: 1 },
  { unique: true }
);

export default mongoose.model("Like", LikeSchema);