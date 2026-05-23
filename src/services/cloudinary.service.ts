import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
    api_key: process.env.CLOUDINARY_API_KEY || "",
    api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

/**
 * Uploads a file buffer to Cloudinary using streaming.
 * This avoids writing the file to the local disk.
 * 
 * @param fileBuffer The image file buffer from Multer memory storage
 * @param folder The folder name on Cloudinary
 * @returns The secure URL of the uploaded image
 */
export const uploadToCloudinary = (fileBuffer: Buffer, folder: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                if (!result) {
                    return reject(new Error("Upload failed, result is undefined"));
                }
                resolve(result.secure_url);
            }
        );
        uploadStream.end(fileBuffer);
    });
};
