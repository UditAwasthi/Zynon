import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {

    const allowedImageTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg"
    ];

    const allowedVideoTypes = [
        "video/mp4",
        "video/quicktime",
        "video/webm"
    ];

    if (
        allowedImageTypes.includes(file.mimetype) ||
        allowedVideoTypes.includes(file.mimetype)
    ) {
        cb(null, true);
    } else {
        cb(new Error("Only images and videos are allowed"), false);
    }
};

export const uploadPostMedia = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max per file
        files: 10 // max 10 media per post
    },
    fileFilter
});