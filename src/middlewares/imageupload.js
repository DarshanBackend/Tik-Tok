import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;
        if (file.fieldname === 'profilePic') {
            uploadPath = 'public/profilePic';
        } else if (file.fieldname === 'audio_image') {
            uploadPath = 'public/audio_image';
        } else if (file.fieldname === 'audio') {
            uploadPath = 'public/audio';
        } else {
            uploadPath = 'public/other';
        }

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const isAudio = file.mimetype.startsWith('audio/');
    const isImage = file.mimetype.startsWith('image/');
    const isOctetStream = file.mimetype === 'application/octet-stream';
    const ext = path.extname(file.originalname).toLowerCase();
    const isJfifExt = ext === '.jfif';

    if (file.fieldname === 'audio') {
        if (isAudio) {
            cb(null, true);
        } else {
            cb(new Error('File for "audio" field must be an audio file.'), false);
        }
    } else if (file.fieldname === 'audio_image' || file.fieldname === 'profilePic') {
        if (isImage || isOctetStream || isJfifExt) {
            cb(null, true);
        } else {
            cb(new Error(`File for "${file.fieldname}" field must be an image.`), false);
        }
    } else {
        cb(new Error(`Invalid field name for file upload: ${file.fieldname}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter
});

const uploadHandlers = {
    single: (fieldName) => upload.single(fieldName),
    fields: (fields) => upload.fields(fields)
};

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
    console.log('Upload error:', err);

    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    } else if (err) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next();
};

const convertJfifToJpeg = async (req, res, next) => {
    try {
        if (!req.files) return next();

        const conversionPromises = [];

        for (const fieldName in req.files) {
            const files = req.files[fieldName];
            for (const file of files) {
                const isImageField = fieldName === 'audio_image' || fieldName === 'profilePic';
                if (!isImageField) continue;

                const ext = path.extname(file.originalname).toLowerCase();
                const isConvertible = ext === '.jfif' || file.mimetype === 'image/jfif' || file.mimetype === 'application/octet-stream';

                if (isConvertible) {
                    const promise = (async () => {
                        const inputPath = file.path;
                        const outputPath = inputPath.replace(/\.[^/.]+$/, "") + ".jpeg";

                        await sharp(inputPath).jpeg().toFile(outputPath);

                        if (fs.existsSync(inputPath)) {
                            fs.unlinkSync(inputPath);
                        }

                        file.path = outputPath;
                        file.filename = path.basename(outputPath);
                        file.mimetype = 'image/jpeg';
                    })();
                    conversionPromises.push(promise);
                }
            }
        }

        await Promise.all(conversionPromises);
        next();
    } catch (err) {
        console.error('Error in convertJfifToJpeg:', err);
        next(err);
    }
};

export { upload, convertJfifToJpeg, handleMulterError };
