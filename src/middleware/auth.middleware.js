import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

//PROTECT ROUTES

export const protect = asyncHandler(async (req, res, next) => {
    let token;

    //Extract Token
    //if for web and else if for mobile and other clients where token is sent in body or header instead of cookie
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer ")
    ) {
        token = req.headers.authorization.split(" ")[1];
    }
    else if (req.cookies?.accessToken) {
        token = req.cookies.accessToken;
    }

    if (!token) {
        throw new ApiError(401, "Not authorized, token missing");
    }

    //Verify Token


    let decoded;

    try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, "Invalid or expired access token");
    }

    //Find User

    const user = await User.findById(decoded.id);

    if (!user) {
        throw new ApiError(401, "User not found");
    }

    if (user.status !== "active") {
        throw new ApiError(403, `Account is ${user.status}`);
    }

    // Attach User To Request
  
    req.user = {
        id: user._id,
        role: user.role,
    };
    next();
});