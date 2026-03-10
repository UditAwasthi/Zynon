import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import redis from "../redis/redisClient.js";
import Message from "../models/chat/message.model.js";

// Safe redis helper — never throws, just logs
const safeRedis = async (fn) => {
    try {
        return await fn();
    } catch (err) {
        console.error("Redis error (non-fatal):", err.message);
        return null;
    }
};

let io;

export const initSocket = (server) => {

    io = new Server(server, {
        cors: {
            origin: [
                "https://zynon-next-js-website.vercel.app",
                "http://localhost:3000",
                "http://127.0.0.1:3000"
            ],
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Socket Authentication
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication error"));
        }

        try {
            const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", async (socket) => {

        const userId = socket.user.id;
        console.log("User connected:", userId);

        // Mark user online
        await safeRedis(() => redis.set(`user:online:${userId}`, "1", "EX", 30));
        await safeRedis(() => redis.set(`user:socket:${userId}`, socket.id));

        // Join chat thread
        socket.on("join_thread", (threadId) => {
            socket.join(threadId);
            console.log(`User ${userId} joined thread ${threadId}`);
        });

        // Message delivered
        socket.on("message_delivered", async ({ messageId }) => {
            try {
                await Message.updateOne(
                    { _id: messageId },
                    { $addToSet: { deliveredTo: socket.user.id } }
                );
                const message = await Message.findById(messageId).lean();
                if (message) {
                    io.to(message.threadId.toString()).emit("message_delivered", {
                        messageId,
                        userId: socket.user.id
                    });
                }
            } catch (err) {
                console.error("message_delivered error:", err.message);
            }
        });

        // Leave chat thread
        socket.on("leave_thread", (threadId) => {
            socket.leave(threadId);
            console.log(`User ${userId} left thread ${threadId}`);
        });

        // Typing start
        socket.on("typing_start", async ({ threadId }) => {
            await safeRedis(() =>
                redis.set(`typing:${threadId}:${userId}`, "1", "EX", 5)
            );
            socket.to(threadId).emit("user_typing", { userId });
        });

        // Typing stop
        socket.on("typing_stop", async ({ threadId }) => {
            await safeRedis(() =>
                redis.del(`typing:${threadId}:${userId}`)
            );
            socket.to(threadId).emit("user_stop_typing", { userId });
        });

        // Disconnect
        socket.on("disconnect", async () => {
            console.log("User disconnected:", userId);
            await safeRedis(() => redis.del(`user:online:${userId}`));
            await safeRedis(() => redis.del(`user:socket:${userId}`));
        });
    });
};

export const getIO = () => {
    if (!io) {
        throw new Error("Socket.io not initialized");
    }
    return io;
};