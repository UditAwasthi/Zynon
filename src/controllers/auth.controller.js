import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { generateAccessToken, generateRefreshToken } from "../utils/generateTokens.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendEmail } from "../services/email.service.js";
import { emailVerificationTemplate } from "../utils/templates/emailTemplates.js";
import { passwordResetTemplate } from "../utils/templates/passresetTemplates.js";

//Deletion Helper Function for stale unverified accounts
const deleteIfExpiredUnverified = async (user) => {
  if (
    !user.emailVerified &&
    user.emailVerificationExpires &&
    user.emailVerificationExpires < Date.now()
  ) {
    await user.deleteOne();
    return true; // means deleted
  }
  return false; // means not deleted
};
// User Registration function
export const signup = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    const deleted = await deleteIfExpiredUnverified(existingUser);

    if (!deleted) {
      if (!existingUser.emailVerified) {
        throw new ApiError(409, "Account exists but email not verified");
      }

      throw new ApiError(409, "User already exists");
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    username,
    email,
    passwordHash,
    emailVerificationExpires: Date.now() + 15 * 60 * 1000, // 15 min window
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const clientType = req.headers["x-client-type"] || "web";

  if (clientType === "web") {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // local dev
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, 201, "User registered successfully", {
      accessToken,
    });
  }

  return sendSuccess(res, 201, "User registered successfully", {
    accessToken,
    refreshToken,
  });
});




// Login function with account lockout and 2FA handling
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

export const login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  // Require at least one identifier
  if (!identifier) {
    throw new ApiError(400, "Email or Username is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  let user;

  if (identifier.includes("@")) {
    user = await User.findOne({ email: identifier.toLowerCase() })
      .select("+passwordHash +twoFactorSecret");
  } else {
    user = await User.findOne({ username: identifier.toLowerCase() })
      .select("+passwordHash +twoFactorSecret");
  }

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }
  if (!user.emailVerified) {
    const deleted = await deleteIfExpiredUnverified(user);

    if (deleted) {
      throw new ApiError(
        400,
        "Verification expired. Please signup again."
      );
    }

    throw new ApiError(403, "Please verify your email first");
  }
  // Check Account Status
  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  // Check Lock
  if (user.lockUntil && user.lockUntil > Date.now()) {
    throw new ApiError(403, "Account temporarily locked. Try later.");
  }

  // Check Password
  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    user.loginAttempts += 1;

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = Date.now() + LOCK_TIME;
    }

    await user.save();

    throw new ApiError(401, "Invalid credentials");
  }

  // Reset login attempts
  user.loginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIP = req.ip;

  await user.save();

  // 2FA Check -- if enabled, require 2FA verification before issuing tokens
  if (user.twoFactorEnabled) {
    return res.status(200).json({
      requiresTwoFactor: true,
      message: "2FA verification required",
    });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const clientType = req.headers["x-client-type"] || "web";

  if (clientType === "web") {
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, 200, "Login successful", {
      accessToken,
    });
  }

  return sendSuccess(res, 200, "Login successful", {
    accessToken,
    refreshToken,
  });
});


//refresh token controller with token versioning and platform-specific handling

export const refreshTokenController = asyncHandler(async (req, res) => {
  const clientType = req.headers["x-client-type"] || "web";

  let refreshToken;

  // Extract refresh token
  if (clientType === "web") {
    refreshToken = req.cookies?.refreshToken;
  } else {
    refreshToken = req.body?.refreshToken;
  }

  if (!refreshToken) {
    throw new ApiError(401, "Refresh token missing");
  }

  let decoded;

  // Verify token signature
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Find user
  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  // Check token version (CRITICAL) -- han hai 🙌
  if (decoded.tokenVersion !== user.refreshTokenVersion) {
    throw new ApiError(401, "Refresh token revoked");
  }

  //Check account status -- if deactivated/suspended/banned to nhi hai 
  if (user.status !== "active") {
    throw new ApiError(403, `Account is ${user.status}`);
  }

  //Generate new tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Deliver tokens based on platform
  if (clientType === "web") {
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, 200, "Token refreshed", {
      accessToken: newAccessToken,
    });
  }

  // Mobile/Desktop
  return sendSuccess(res, 200, "Token refreshed", {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

//LOGOUT (Single Device)
export const logout = asyncHandler(async (req, res) => {
  const clientType = req.headers["x-client-type"] || "web";

  if (clientType === "web") {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
  }

  return sendSuccess(res, 200, "Logged out successfully");
});
//LOGOUT ALL DEVICES

export const logoutAll = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  user.refreshTokenVersion += 1;
  await user.save();

  res.clearCookie("refreshToken");

  return sendSuccess(res, 200, "Logged out from all devices");
});


//SEND EMAIL VERIFICATION 

export const sendEmailVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+emailVerificationResendAfter");


  if (!user) throw new ApiError(404, "User not found");

  if (user.emailVerified) {
    throw new ApiError(400, "Email already verified");
  }

  // 🔒 Cooldown Check
  if (
    user.emailVerificationResendAfter &&
    user.emailVerificationResendAfter > Date.now()
  ) {
    const secondsLeft = Math.ceil(
      (user.emailVerificationResendAfter - Date.now()) / 1000
    );

    throw new ApiError(429, `Please wait ${secondsLeft}s before requesting again`);
  }

  // Generate OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  const hashedOTP = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  user.emailVerificationOTP = hashedOTP;
  user.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 min
  user.emailVerificationAttempts = 0; // reset attempts
  user.emailVerificationResendAfter = Date.now() + 60 * 1000; // 60s cooldown

  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Your Verification OTP",
    html: emailVerificationTemplate(otp)
  });

  return sendSuccess(res, 200, "OTP sent successfully");
});


//VERIFY EMAIL
export const verifyEmail = asyncHandler(async (req, res) => {
  const { otp, email } = req.body;

  if (!otp || !email) throw new ApiError(400, "OTP and email are required");

  const hashedOTP = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  const user = await User.findOne({
    email: email.toLowerCase(),
    emailVerificationExpires: { $gt: Date.now() }
  }).select("+emailVerificationOTP +emailVerificationAttempts");
  if (!user) {
    throw new ApiError(400, "Invalid or expired OTP");
  }

  // 🚨 Attempt Limit Check
  if (user.emailVerificationAttempts >= 5) {
    throw new ApiError(429, "Too many incorrect attempts. Request new OTP.");
  }

  if (user.emailVerificationOTP !== hashedOTP) {
    user.emailVerificationAttempts += 1;
    await user.save();
    throw new ApiError(400, "Invalid OTP");
  }

  // Success
  user.emailVerified = true;
  user.emailVerificationOTP = undefined;
  user.emailVerificationExpires = undefined;
  user.emailVerificationAttempts = 0;

  await user.save();

  return sendSuccess(res, 200, "Email verified successfully");
});


//Password Reset Request
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email: email.toLowerCase() })

  if (!user) {
    // To prevent email enumeration, respond with success even if user not found
    return sendSuccess(res, 200, "If an account with that email exists, a reset link has been sent");
  }

  // Cooldown
  if (
    user.passwordResetResendAfter &&
    user.passwordResetResendAfter > Date.now()
  ) {
    const secondsLeft = Math.ceil(
      (user.passwordResetResendAfter - Date.now()) / 1000
    );
    throw new ApiError(429, `Please wait ${secondsLeft}s`);
  }

  //generate reset otp
  const otp = crypto.randomInt(100000, 999999).toString();

  const hashedOTP = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  user.passwordResetOTP = hashedOTP;
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  user.passwordResetAttempts = 0;
  user.passwordResetResendAfter = Date.now() + 60 * 1000;
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Password Reset OTP",
    html: passwordResetTemplate(otp)
  });

  return sendSuccess(res, 200, "If an account with that email exists, OTP has been sent");

});

//Password Reset
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "Email, OTP and new password are required");
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
    passwordResetExpires: { $gt: Date.now() }
  }).select("+passwordResetOTP +passwordResetAttempts");

  if (!user) {
    throw new ApiError(400, "Invalid or expired OTP");
  }
  if (user.passwordResetAttempts >= 5) {
    throw new ApiError(429, "Too many failed attempts");
  }


  const hashedOTP = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
  if (user.passwordResetOTP !== hashedOTP) {
    user.passwordResetAttempts += 1;
    await user.save();
    throw new ApiError(400, "Wrong OTP");
  }


  // Update password correctly
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  user.refreshTokenVersion += 1;

  // Clear reset fields
  user.passwordResetOTP = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetAttempts = 0;

  await user.save();

  return sendSuccess(res, 200, "Password reset successfully");

})