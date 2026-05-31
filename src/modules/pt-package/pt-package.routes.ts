import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    getPackages, 
    getPackageCoaches, 
    createPackage, 
    updatePackage, 
    setCoachPrice,
    activatePackage,
    deactivatePackage,
    activateCoachPackage,
    deactivateCoachPackage
} from './pt-package.controller';

const router = Router();

// Yêu cầu đăng nhập mới được xem và cấu hình các gói tập PT
router.use(authMiddleware);

// API cho Hội viên
router.get('/', getPackages);
router.get('/:id/coaches', getPackageCoaches);

// API Quản trị cho Admin
router.post('/', createPackage);
router.put('/:id', updatePackage);
router.post('/set-price', setCoachPrice);

// Admin bật/tắt gói PT toàn phòng gym
router.patch('/:id/activate', activatePackage);
router.patch('/:id/deactivate', deactivatePackage);

// Admin bật/tắt quyền dạy gói PT của huấn luyện viên cụ thể
router.patch('/:id/coaches/:coachId/activate', activateCoachPackage);
router.patch('/:id/coaches/:coachId/deactivate', deactivateCoachPackage);

export default router;
