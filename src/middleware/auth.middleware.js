import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

//PROTECT ROUTES ~ best practices inspired chatgpt's recommendations and my own experience with auth implementations. Always check for token first, then find user, then check password change, then attach user to req. This way we minimize unnecessary DB lookups and ensure security checks are done in the right order.

export const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")
    ) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }

    if (!token) {
        throw new ApiError(401, "Not authorized, token missing");
    }

    let decoded;

    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }

    // 🔥 Find user FIRST
    const user = await User.findById(decoded.id);

    if (!user) {
        throw new ApiError(401, "User not found");
    }

    if (user.status !== "active") {
        throw new ApiError(403, `Account is ${user.status}`);
    }

    // 🔐 Invalidate token if password changed
    if (user.passwordChangedAt) {
        const passwordChangedTimestamp = parseInt(
            user.passwordChangedAt.getTime() / 1000,
            10
        );

        if (decoded.iat < passwordChangedTimestamp) {
            throw new ApiError(
                401,
                "Password recently changed. Please login again."
            );
        }
    }

    req.user = {
        id: user._id,
        role: user.role,
    };

    next();
});


export const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            token = req.headers.authorization.split(" ")[1];
        } else if (req.cookies?.accessToken) {
            token = req.cookies.accessToken;
        }

        // If no token → continue without user
        if (!token) {
            return next();
        }

        let decoded;

        try {
            decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        } catch {
            return next(); // invalid token → ignore
        }

        const user = await User.findById(decoded.id).select("_id role status passwordChangedAt");

        if (!user || user.status !== "active") {
            return next();
        }

        if (user.passwordChangedAt) {
            const passwordChangedTimestamp = parseInt(
                user.passwordChangedAt.getTime() / 1000,
                10
            );

            if (decoded.iat < passwordChangedTimestamp) {
                return next();
            }
        }

        req.user = {
            id: user._id,
            role: user.role
        };

        next();
    } catch {
        next(); // fail silently
    }
};