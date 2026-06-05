import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getDashboardStats } from "./dashboard.controller";

const router = Router();

// Áp dụng xác thực đăng nhập trước khi truy cập
router.use(authMiddleware);

router.get("/admin/stats", getDashboardStats);

export default router;