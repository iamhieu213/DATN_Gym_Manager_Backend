import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    getAllCoaches, 
    getCoach, 
    updateMyProfile, 
    updateMyAvailability, 
    getMyProfile,
    getMyAvailability,
    getCoachesForAdmin,
    updateCoachStatusByAdmin
} from './coach.controller';

const router = Router();

// ================= Lọc công khai (Không cần đăng nhập) =================
router.get('/', getAllCoaches);
router.get('/:id', getCoach);

// ================= Quản lý tài khoản PT (Yêu cầu đăng nhập) =================
router.get('/profile/me', authMiddleware, getMyProfile);
router.put('/profile', authMiddleware, updateMyProfile);

router.get('/availability/me', authMiddleware, getMyAvailability);
router.put('/availability', authMiddleware, updateMyAvailability);

// ================= Quản trị của Admin (Yêu cầu quyền ADMIN) =================
router.get('/admin/list', authMiddleware, getCoachesForAdmin);
router.patch('/admin/:id/status', authMiddleware, updateCoachStatusByAdmin);

export default router;