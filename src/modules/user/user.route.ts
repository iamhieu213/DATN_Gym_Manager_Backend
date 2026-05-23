import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getAllUsers,
    getMyProfile,
    updateMyProfile,
    getUserById,
    createUser,
    updateUser,
    updateUserStatus
 } from "./user.controller";
 
const router = Router();

// Áp dụng middleware xác thực cho tất cả các API bên dưới
router.use(authMiddleware);

// --- APIs cho người dùng tự xử lý ---
router.get("/me", getMyProfile);         // GET /users/me
router.patch("/me", updateMyProfile);     // PATCH /users/me

// --- APIs cho ban quản trị (ADMIN/STAFF) ---
router.get("/", getAllUsers);             // GET /users
router.post("/", createUser);             // POST /users
router.get("/:id", getUserById);         // GET /users/:id
router.patch("/:id", updateUser);         // PATCH /users/:id
router.patch("/:id/status", updateUserStatus); // PATCH /users/:id/status

export default router;