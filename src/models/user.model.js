import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 30
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },

    role: {
        type: String,
        enum: ["user", "admin", "moderator"],
        default: "user"
    },

    passwordHash: {
        type: String,
        required: true,
        select: false
    },
    passwordResetOTP: {
        type: String,
        select: false
    },

    passwordResetExpires: {
        type: Date,
        select: false
    },

    passwordResetAttempts: {
        type: Number,
        default: 0
    },

    passwordResetResendAfter: {
        type: Date
    },
    passwordChangedAt: Date,

    refreshTokenVersion: {
        type: Number,
        default: 0
    },
    currentRefreshTokenHash: {
        type: String,
        select: false
    },
    loginAttempts: {
        type: Number,
        default: 0
    },

    lockUntil: Date,

    lastLoginAt: Date,
    lastLoginIP: String,

    twoFactorEnabled: {
        type: Boolean,
        default: false
    },

    twoFactorSecret: {
        type: String,
        select: false
    },

    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationOTP: {
        type: String,
        select: false
    },
    emailVerificationExpires: {
        type: Date,
        select: false
    },
    emailVerificationAttempts: {
        type: Number,
        default: 0
    },

    emailVerificationResendAfter: {
        type: Date
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ["active", "deactivated", "suspended", "shadow_banned", "deleted"],
        default: "active",

    },

    suspensionReason: String,
    deletedAt: Date,
    deactivatedAt: Date,

    termsAcceptedAt: Date,
    privacyPolicyAcceptedAt: Date,

    gdprConsent: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true,
    versionKey: false
});
userSchema.index({ status: 1 });
userSchema.index({ email: 1, status: 1 });
export default mongoose.model("User", userSchema);