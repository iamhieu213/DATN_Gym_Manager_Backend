import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    getAllCoaches, 
    getCoach, 
    updateMyProfile, 
    updateMyAvailability, 
} from './coach.controller';
const router = Router();
router.use(authMiddleware);
// Members & general
router.get('/', getAllCoaches);
router.get('/:id', getCoach);
// Coach self management
router.put('/profile', updateMyProfile);
router.put('/availability', updateMyAvailability);

export default router;