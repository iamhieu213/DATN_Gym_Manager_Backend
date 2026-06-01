import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { 
    buyMembership, 
    upgradeMembership, 
    cancelMembership, 
    getActiveMembership, 
    getMyHistory, 
    getAllMemberships,
} from "./membership.controller";

const router = Router();




// Áp dụng xác thực cho toàn bộ các API
router.use(authMiddleware);

// --- Của Hội viên (USER) ---
router.post("/buy", buyMembership);                         // Đăng ký mua gói
router.post("/upgrade", upgradeMembership);                 // Nâng cấp gói tập
router.get("/active", getActiveMembership);                 // Lấy gói đang hoạt động
router.get("/my-history", getMyHistory);                     // Lịch sử mua của tôi

// --- Của Quản trị viên (STAFF/ADMIN) ---
router.get("/", getAllMemberships);                          // Quản lý xem toàn bộ danh sách gói tập
router.post("/:id/cancel", cancelMembership);                // Admin hủy gói tập

export default router;