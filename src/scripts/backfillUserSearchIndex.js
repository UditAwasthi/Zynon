import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Redis from "ioredis";
import User from "../models/user.model.js";

const redis = new Redis(process.env.REDIS_URL, {
    tls: {},
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));

const generatePrefixes = (username) => {
    const prefixes = [];
    let current = "";

    for (const char of username) {
        current += char;
        prefixes.push(current);
    }

    return prefixes;
};

const run = async () => {



    await mongoose.connect(process.env.MONGO_URI);
    console.log("Mongo connected");

    await redis.ping();
    console.log("Redis ready");
    const users = await User.find().select("username");

    for (const user of users) {

        const username = user.username.toLowerCase();
        const prefixes = generatePrefixes(username);

        for (const prefix of prefixes) {
            await redis.zadd(`search:user:${prefix}`, 0, username);
        }

        console.log("Indexed:", username);
    }

    console.log("Finished indexing users");

    process.exit();
};

run();