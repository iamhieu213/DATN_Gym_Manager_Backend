import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    getUserNotifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead 
} from './notification.controller';
const router = Router();
// Yêu cầu tất cả API thông báo phải đăng nhập
router.use(authMiddleware);
router.get('/', getUserNotifications); // GET /notifications
router.patch('/read-all', markAllNotificationsAsRead); // PATCH /notifications/read-all
router.patch('/:id/read', markNotificationAsRead); // PATCH /notifications/:id/read
export default router;