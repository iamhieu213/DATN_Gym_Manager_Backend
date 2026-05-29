import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { checkInByPhone, getMyHistory, getAllHistory } from "./checkin.controller";

const router = Router();

// Áp dụng xác thực đăng nhập cho TOÀN BỘ các API check-in dưới đây
router.use(authMiddleware);

// API Check-in bằng SĐT (Chỉ dành cho Lễ tân/Admin - kiểm tra quyền ở Controller)
router.post("/", checkInByPhone);

// Hội viên tự xem lịch sử của mình
router.get("/my-history", getMyHistory);

// Admin/Staff xem lịch sử toàn phòng tập
router.get("/history", getAllHistory);

export default router;