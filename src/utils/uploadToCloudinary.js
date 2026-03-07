import cloudinary from "../config/cloudinary.js";

export const uploadImage = async (file) => {

  const isVideo = file.mimetype.startsWith("video/");

  const result = await cloudinary.uploader.upload(
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    {
      folder: "zynon/profile_photos",
      resource_type: isVideo ? "video" : "image",

      ...(isVideo
        ? {}
        : {
            transformation: [
              { width: 500, height: 500, crop: "fill", gravity: "face" },
              { quality: "auto", fetch_format: "auto" }
            ]
          })
    }
  );

  return result;
};
