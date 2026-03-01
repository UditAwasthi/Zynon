import bcrypt from "bcryptjs";
import User from "../models/user.model.js";
import { generateAccessToken, generateRefreshToken } from "../utils/generateTokens.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    throw new ApiError(409, "User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    username,
    email,
    passwordHash,
  });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

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
    res.clearCookie("refreshToken");
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