import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { getPackages, getPackageCoaches, createPackage, updatePackage, setCoachPrice } from './pt-package.controller';

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

export default router;
