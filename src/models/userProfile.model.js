import mongoose from "mongoose";

const userProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
            immutable: true
        },
        name: {
            type: String,
            trim: true,
            minlength: 1,
            maxlength: 50
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 160
        },

        profilePicture: {
            type: String,
            trim: true,
            default: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"
        },

        coverPhoto: {
            type: String,
            trim: true,
            default: "https://cdn.zynon.com/defaults/cover.png"
        },

        location: {
            type: String,
            trim: true,
            maxlength: 100
        },

        website: {
            type: String,
            trim: true,
            maxlength: 200,
            validate: {
                validator: v =>
                    !v || /^(https?:\/\/)?([\w\d-]+\.)+\w{2,}(\/.*)?$/.test(v),
                message: "Invalid website URL"
            }
        },

        pronouns: {
            type: String,
            trim: true,
            maxlength: 50
        },

        dateOfBirth: Date,

        gender: {
            type: String,
            enum: ["male", "female", "non-binary", "other", "prefer_not_to_say"]
        },

        category: {
            type: String,
            enum: ["personal", "creator", "business"],
            default: "personal",
            index: true
        },

        isPrivate: {
            type: Boolean,
            default: false,
            index: true
        },

        isVerified: {
            type: Boolean,
            default: false,
            index: true
        },

        allowMessagesFromNonFollowers: {
            type: Boolean,
            default: true
        },

        followersCount: {
            type: Number,
            default: 0,
            min: 0
        },

        followingCount: {
            type: Number,
            default: 0,
            min: 0
        },

        postsCount: {
            type: Number,
            default: 0,
            min: 0
        },

        moderationFlags: {
            type: Number,
            default: 0
        },

        profileVisibility: {
            type: String,
            enum: ["public", "followers_only"],
            default: "public"
        }
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

userProfileSchema.index(
    { name: "text", bio: "text" },
    { weights: { name: 5, bio: 2 } }
);


export default mongoose.model("UserProfile", userProfileSchema);