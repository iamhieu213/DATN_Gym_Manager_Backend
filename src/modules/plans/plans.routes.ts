import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { 
    getAllPlans, 
    getPlanById, 
    createPlan, 
    updatePlan, 
    activatePlan, 
    deactivatePlan 
} from "./plans.controller";

const router = Router();

// Yêu cầu đăng nhập trước khi truy cập
// router.use(authMiddleware);

// --- APIs Public (Hội viên / Nhân viên đều xem được) ---
router.get("/", getAllPlans);          // GET /plans (lấy danh sách)
router.get("/:id", getPlanById);      // GET /plans/:id (lấy chi tiết)

// --- APIs Quản trị (Chỉ Admin) ---
router.post("/", createPlan);         // POST /plans (tạo mới)
router.patch("/:id", updatePlan);     // PATCH /plans/:id (cập nhật)
router.patch("/:id/activate", activatePlan);     // PATCH /plans/:id/activate (mở khóa)
router.patch("/:id/deactivate", deactivatePlan); // PATCH /plans/:id/deactivate (khóa gói)

export default router;