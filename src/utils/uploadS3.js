import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import path from "path";


const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
});

/**
 * Upload a buffer to S3
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - Folder in S3 bucket
 * @returns {Promise<string>} - The URL of the uploaded file
 */
export const uploadToS3 = async (fileBuffer, fileName, mimeType, folder = "uploads") => {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 15)}${fileExtension}`;

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: uniqueFileName,
        Body: fileBuffer,
        ContentType: mimeType,
    };

    try {
        await s3Client.send(new PutObjectCommand(params));
        return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${uniqueFileName}`;
    } catch (error) {
        console.error("S3 Upload Error:", error);
        throw new Error("Failed to upload file to S3");
    }
};

/**
 * Resize image using sharp
 * @param {Buffer} buffer - Image buffer
 * @param {Object} options - Resize options { width, height, quality }
 * @returns {Promise<Buffer>} - Resized image buffer
 */
export const resizeImage = async (buffer, { width, height, quality = 80 } = {}) => {
    let pipeline = sharp(buffer);
    
    if (width || height) {
        pipeline = pipeline.resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true
        });
    }

    return await pipeline
        .jpeg({ quality })
        .toBuffer();
};

/**
 * List all objects in the S3 bucket
 * @returns {Promise<string[]>} - Array of URLs
 */
export const listAllS3Images = async () => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
    };

    try {
        const data = await s3Client.send(new ListObjectsV2Command(params));
        if (!data.Contents) return [];
        return data.Contents.map(item => `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${item.Key}`);
    } catch (error) {
        console.error("S3 List Error:", error);
        throw new Error("Failed to list files from S3");
    }
};

/**
 * Delete an object from S3
 * @param {string} key - The S3 object key
 * @returns {Promise<void>}
 */
export const deleteFromS3 = async (key) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    };

    try {
        await s3Client.send(new DeleteObjectCommand(params));
    } catch (error) {
        console.error("S3 Delete Error:", error);
        throw new Error("Failed to delete file from S3");
    }
};

