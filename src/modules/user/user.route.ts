import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/multer.middleware";
import { getAllUsers,
    getMyProfile,
    updateMyProfile,
    updateMyAvatar,
    getUserById,
    createUser,
    updateUser,
    updateUserStatus,
    softDeleteUser,
    resetUserPassword,
    getUserStats
 } from "./user.controller";
 
const router = Router();

// Áp dụng middleware xác thực cho tất cả các API bên dưới
router.use(authMiddleware);

// --- APIs cho người dùng tự xử lý ---
router.get("/me", getMyProfile);         // GET /users/me
router.patch("/me", updateMyProfile);     // PATCH /users/me
router.patch("/me/avatar", upload.single("avatar"), updateMyAvatar); // PATCH /users/me/avatar

// --- APIs cho ban quản trị (ADMIN/STAFF) ---
router.get("/", getAllUsers);             // GET /users
router.post("/", createUser);             // POST /users
router.get("/stats", getUserStats);      // GET /users/stats
router.get("/:id", getUserById);         // GET /users/:id
router.patch("/:id", updateUser);         // PATCH /users/:id
router.patch("/:id/status", updateUserStatus); // PATCH /users/:id/status
router.delete("/:id", softDeleteUser); // DELETE /users/:id (thực chất là cập nhật status thành DELETED - soft delete)
router.post("/:id/reset-password", resetUserPassword); // POST /users/:id/reset-password
export default router;