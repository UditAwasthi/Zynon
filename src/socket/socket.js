import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import redis from "../redis/redisClient.js";
import Message from "../models/chat/message.model.js"
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

    /*
    Socket Authentication
    */
    io.use((socket, next) => {

        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication error"));
        }

        try {
            const decoded = jwt.verify(
                token,
                process.env.ACCESS_TOKEN_SECRET
            );

            socket.user = decoded;
            next();

        } catch (err) {
            return next(new Error("Invalid token"));
        }
    });

    io.on("connection", async (socket) => {

        const userId = socket.user.id;
        /* mark user online */
        await redis.set(`user:online:${userId}`, "1", "EX", 30);
        await redis.set(`user:socket:${userId}`, socket.id);
        /*
        Join chat thread
        */
        socket.on("join_thread", (threadId) => {

            socket.join(threadId);

        });
        //meesage delievered 
        socket.on("message_delivered", async ({ messageId }) => {

            await Message.updateOne(
                { _id: messageId },
                { $addToSet: { deliveredTo: socket.user.id } }
            );

        });
        /*
        Leave chat thread
        */
        socket.on("leave_thread", (threadId) => {

            socket.leave(threadId);



        });
        //typing start
        socket.on("typing_start", async ({ threadId }) => {

            const userId = socket.user.id;

            await redis.set(
                `typing:${threadId}:${userId}`,
                "1",
                "EX",
                5
            );

            socket.to(threadId).emit("user_typing", { userId });

        });
        //typing stop
        socket.on("typing_stop", async ({ threadId }) => {

            const userId = socket.user.id;

            await redis.del(`typing:${threadId}:${userId}`);

            socket.to(threadId).emit("user_stop_typing", { userId });

        });

        /*
        Disconnect
        */
        socket.on("disconnect", async () => {



            await redis.del(`user:online:${userId}`);
            await redis.del(`user:socket:${userId}`);

        });

    });

};

export const getIO = () => {

    if (!io) {
        throw new Error("Socket.io not initialized");
    }

    return io;
};