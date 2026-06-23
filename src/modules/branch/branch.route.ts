import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { 
    getAllBranches, 
    getBranchById, 
    createBranch, 
    updateBranch, 
    activeBranch,
    deactiveBranch
} from "./branch.controller";

const router = Router();

// Áp dụng middleware bắt buộc phải đăng nhập cho tất cả API bên dưới
router.use(authMiddleware);

// --- API cho mọi đối tượng đã đăng nhập ---
router.get("/", getAllBranches);                  // Lấy danh sách chi nhánh (GET /branch)
router.get("/:id", getBranchById);                // Xem chi tiết chi nhánh (GET /branch/:id)

// --- API chỉ dành riêng cho ADMIN (Chủ chuỗi phòng tập) ---
router.post("/", createBranch);                   // Tạo chi nhánh mới (POST /branch)
router.patch("/:id", updateBranch);               // Cập nhật thông tin (PATCH /branch/:id)
router.patch("/:id/activate", activeBranch);   // Kích hoạt hoạt động (PATCH /branch/:id/activate)
router.patch("/:id/deactivate", deactiveBranch); // Khóa hoạt động (PATCH /branch/:id/deactivate)

export default router;