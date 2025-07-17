import multer from 'multer';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'public/images'; // Default path

        if (file.fieldname === 'profilePic') {
            uploadPath = 'public/profilePic';
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
    const allowedFieldNames = ['profilePic'];
    if (allowedFieldNames.includes(file.fieldname)) {
        cb(null, true);
    } else {
        cb(new Error(`Please upload a file with one of these field names: ${allowedFieldNames.join(', ')}`));
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
        if (!req.file) return next();

        const file = req.file;
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === '.jfif' || file.mimetype === 'image/jfif' || file.mimetype === 'application/octet-stream') {
            const inputPath = file.path;
            const outputPath = inputPath.replace('.jfif', '.jpg');

            await sharp(inputPath)
                .jpeg()
                .toFile(outputPath);

            // Update the file path in req.file
            file.path = outputPath;
            file.filename = path.basename(outputPath);

            // Delete the original JFIF file
            fs.unlinkSync(inputPath);
        }

        next();
    } catch (err) {
        console.error('Error in convertJfifToJpeg:', err);
        next(err);
    }
};

export { upload, uploadHandlers };
export default uploadHandlers;
