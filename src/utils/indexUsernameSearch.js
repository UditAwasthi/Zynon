import redis from "../redis/redisClient.js"
import { generatePrefixes } from "./generatePrefixes.js"


export const indexUsernameSearch = async (username) => {

    const prefixes = generatePrefixes(username.toLowerCase());

    const pipeline = redis.pipeline();

    for (const prefix of prefixes) {
        pipeline.zadd(`search:user:${prefix}`, 0, username);
    }

    await pipeline.exec();
};