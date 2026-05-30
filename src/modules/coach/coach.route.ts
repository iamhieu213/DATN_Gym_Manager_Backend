import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    getAllCoaches, 
    getCoach, 
    updateMyProfile, 
    updateMyAvailability, 
    getMyProfile,
    getMyAvailability
} from './coach.controller';
const router = Router();
router.use(authMiddleware);
// Members & general
router.get('/', getAllCoaches);
router.get('/:id', getCoach);
// Coach self management
router.get('/profile/me', authMiddleware, getMyProfile);
router.put('/profile', updateMyProfile);
router.get('/availability/me', authMiddleware, getMyAvailability);
router.put('/availability', updateMyAvailability);

export default router;