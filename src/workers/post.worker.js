import { Worker } from "bullmq";
import { uploadImage } from "../utils/uploadToCloudinary.js";
import Post from "../models/content/post.model.js";
import connection from "../config/redis.js";

new Worker(
  "post-upload",
  async (job) => {

    const { postId, files } = job.data;

    const mediaArray = [];

    for (const file of files) {

      const result = await uploadImage(file);

      const type = file.mimetype.startsWith("image/") ? "image" : "video";

      mediaArray.push({
        url: result.secure_url,
        type,
        width: result.width || null,
        height: result.height || null,
        duration: result.duration || null
      });
    }

    await Post.findByIdAndUpdate(postId, {
      media: mediaArray,
      status: "published"
    });

  },
  { connection }
);