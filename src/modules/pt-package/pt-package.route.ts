import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { getPackages, getPackageCoaches, createPackage, setCoachPrice } from './pt-package.controller';

const router = Router();

// Áp dụng xác thực cho tất cả API của gói tập PT
// router.use(authMiddleware);

// API dành cho Hội viên
router.get('/', getPackages);
router.get('/:id/coaches', getPackageCoaches);

// API dành cho Admin
router.post('/', createPackage);
router.post('/set-price', setCoachPrice);

export default router;