import multer from "multer";

// Sử dụng memoryStorage để tránh ghi file tạm lên đĩa cứng của server
const storage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Giới hạn kích thước file 5MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Chỉ chấp nhận file ảnh!") as any);
        }
    },
});
