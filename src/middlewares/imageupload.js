import multer from 'multer';
import path from 'path';
import { uploadToS3, resizeImage } from '../utils/uploadS3.js';

// Use memory storage for S3 uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const isAudio = file.mimetype.startsWith('audio/');
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    const isOctetStream = file.mimetype === 'application/octet-stream';
    const ext = path.extname(file.originalname).toLowerCase();
    const isJfifExt = ext === '.jfif';

    if (file.fieldname === 'audio') {
        if (isAudio) {
            cb(null, true);
        } else {
            cb(new Error('File for "audio" field must be an audio file.'), false);
        }
    } else if (file.fieldname === 'audio_image' || file.fieldname === 'profilePic' || file.fieldname === 'post_image') {
        if (isImage || isOctetStream || isJfifExt) {
            cb(null, true);
        } else {
            cb(new Error(`File for "${file.fieldname}" field must be an image.`), false);
        }
    } else if (file.fieldname === 'post_video') {
        if (isVideo) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'), false);
        }
    } else {
        cb(new Error(`Invalid field name for file upload: ${file.fieldname}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 200 } // 200MB file size limit
});

// Middleware to process and upload to S3
const uploadToS3Middleware = async (req, res, next) => {
    try {
        if (!req.files && !req.file) return next();

        const uploadPromises = [];

        // Handle single file (if upload.single was used)
        if (req.file) {
            const file = req.file;
            let folder = "others";
            if (file.fieldname === "profilePic") folder = "profile_pics";

            const promise = (async () => {
                let buffer = file.buffer;
                let mimetype = file.mimetype;
                let originalname = file.originalname;

                // Resize profile pics
                if (file.fieldname === "profilePic") {
                    buffer = await resizeImage(buffer, { width: 400, height: 400 });
                    mimetype = 'image/jpeg';
                    if (!originalname.toLowerCase().endsWith('.jpeg') && !originalname.toLowerCase().endsWith('.jpg')) {
                        originalname = originalname.replace(/\.[^/.]+$/, "") + ".jpeg";
                    }
                }

                const s3Url = await uploadToS3(buffer, originalname, mimetype, folder);
                file.path = s3Url; // Set path to S3 URL for compatibility with existing controllers
                file.location = s3Url;
            })();
            uploadPromises.push(promise);
        }

        // Handle multiple fields (if upload.fields was used)
        if (req.files) {
            for (const fieldName in req.files) {
                const files = req.files[fieldName];
                for (const file of files) {
                    let folder = "others";
                    if (fieldName === "profilePic") folder = "profile_pics";
                    else if (fieldName === "audio") folder = "audios";
                    else if (fieldName === "audio_image") folder = "audio_images";
                    else if (fieldName === "post_image") folder = "post_images";
                    else if (fieldName === "post_video") folder = "post_videos";

                    const promise = (async () => {
                        let buffer = file.buffer;
                        let mimetype = file.mimetype;
                        let originalname = file.originalname;

                        // Image processing
                        const isImageField = ['profilePic', 'audio_image', 'post_image'].includes(fieldName);
                        if (isImageField) {
                            let resizeOptions = {};
                            if (fieldName === 'profilePic') resizeOptions = { width: 400, height: 400 };
                            else if (fieldName === 'post_image') resizeOptions = { width: 1024, height: 1024 };
                            else if (fieldName === 'audio_image') resizeOptions = { width: 500, height: 500 };

                            buffer = await resizeImage(buffer, resizeOptions);
                            mimetype = 'image/jpeg';
                            if (!originalname.toLowerCase().endsWith('.jpeg') && !originalname.toLowerCase().endsWith('.jpg')) {
                                originalname = originalname.replace(/\.[^/.]+$/, "") + ".jpeg";
                            }
                        }

                        const s3Url = await uploadToS3(buffer, originalname, mimetype, folder);
                        file.path = s3Url; // Set path to S3 URL for compatibility
                        file.location = s3Url;
                    })();
                    uploadPromises.push(promise);
                }
            }
        }

        await Promise.all(uploadPromises);
        next();
    } catch (error) {
        console.error("S3 Upload Middleware Error:", error);
        res.status(500).json({ success: false, message: "Error uploading files to S3" });
    }
};

// Placeholder for backward compatibility if needed
const convertJfifToJpeg = (req, res, next) => next();

export { upload, uploadToS3Middleware, convertJfifToJpeg };
