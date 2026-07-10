import { NotificationRepository } from './notification.repository';
import { NotificationType } from '@prisma/client';
import { sendToUser } from '../../services/socket.service';

export class NotificationService {
    constructor(private readonly repository: NotificationRepository) { }

    public async createNotification(payload: {
        userId: number;
        title: string;
        content: string;
        type: NotificationType;
        referenceId?: string;
    }) {
        //Luu vao DB
        const notification = await this.repository.createNotification(payload);

        //Ban tin nhan qua socket 
        sendToUser(payload.userId, 'new_notification', notification);

        return notification;
    }

    //Lay thong bao phan trang cua nguoi dung
    public async getUserNotifications(userId: number, page: number, limit: number) {
        const skip = (page - 1) * limit;

        const [notifications, totalUnread] = await Promise.all([
            this.repository.findUserNotifications(userId, skip, limit),
            this.repository.countUnreadNotifications(userId)
        ]);

        return { notifications, totalUnread };
    }

    // Đọc thông báo
    public async markAsRead(userId: number, notificationId: number) {
        await this.repository.markAsRead(userId, notificationId);
    }
    // Đọc tất cả thông báo
    public async markAllAsRead(userId: number) {
        await this.repository.markAllAsRead(userId);
    }
}