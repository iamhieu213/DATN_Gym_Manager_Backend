import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { prisma } from '../../config/client';

const repository = new NotificationRepository(prisma);
const service = new NotificationService(repository);

// Lấy danh sách thông báo có phân trang
export const getUserNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Chưa xác thực." });

        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = parseInt(req.query.limit as string, 10) || 15;

        const result = await service.getUserNotifications(userId, page, limit);

        res.status(200).json({
            success: true,
            message: "Lấy danh sách thông báo thành công.",
            data: result
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Lỗi máy chủ.", error: error.message });
    }
};

// Đánh dấu đã đọc
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Chưa xác thực." });

        const notificationId = parseInt(req.params.id as string, 10);
        if (isNaN(notificationId)) {
            return res.status(400).json({ success: false, message: "ID thông báo không hợp lệ." });
        }

        await service.markAsRead(userId, notificationId);

        res.status(200).json({ success: true, message: "Đã đọc thông báo." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Lỗi máy chủ.", error: error.message });
    }
};

// Đọc tất cả thông báo
export const markAllNotificationsAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ success: false, message: "Chưa xác thực." });

        await service.markAllAsRead(userId);

        res.status(200).json({ success: true, message: "Đã đọc tất cả thông báo." });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Lỗi máy chủ.", error: error.message });
    }
};