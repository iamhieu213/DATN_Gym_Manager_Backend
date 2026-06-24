import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    getPackages, 
    getPackageCoaches, 
    createPackage, 
    setCoachPrice,
    updatePackage,
    activatePackage,
    deactivatePackage,
    activateCoachPackage,
    deactivateCoachPackage
} from './pt-package.controller';

const router = Router();

// Áp dụng xác thực cho tất cả API của gói tập PT
router.use(authMiddleware);

// API dành cho Hội viên / PT
router.get('/', getPackages);
router.get('/:id/coaches', getPackageCoaches);

// API dành cho Admin
router.post('/', createPackage);
router.put('/:id', updatePackage);
router.post('/set-price', setCoachPrice);
router.patch('/:id/activate', activatePackage);
router.patch('/:id/deactivate', deactivatePackage);
router.patch('/:id/coach/:coachId/activate', activateCoachPackage);
router.patch('/:id/coach/:coachId/deactivate', deactivateCoachPackage);

export default router;