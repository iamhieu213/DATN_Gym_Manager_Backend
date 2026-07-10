import { PrismaClient, Notification } from '@prisma/client';

export class NotificationRepository {
    constructor(private readonly prisma: PrismaClient) {} 

    //Tao thong bao moi luu vao DB
    public async createNotification(data : { userId: number, title: string, content: string, type: any, referenceId? : string }): Promise<Notification> {
        return this.prisma.notification.create({
            data: {
                userId: data.userId,
                title: data.title,
                content: data.content,
                type: data.type,
                referenceId: data.referenceId || null,
            }
        });
    }

    //Lay danh sach thong bao cua user
    public async findUserNotifications(userId: number, skip : number, limit : number) : Promise<Notification[]> {
        return this.prisma.notification.findMany({
            where : { userId },
            orderBy : { createdAt : 'desc' },
            skip,
            take: limit
        })
    }

    //Dem so luong thong bao chua doc
    public async countUnreadNotifications(userId : number) : Promise<number> {
        return this.prisma.notification.count(({
            where : { userId, isRead : false }
        }))
    }

    //Danh dau 1 thong bao la da doc
    public async markAsRead(userId: number, notificationId: number) : Promise<void> {
        await this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true }
        });
    }

    //Danh dau da doc tat ca thong bao cua user
    public async markAllAsRead(userId: number) : Promise<void> {
        await this.prisma.notification.updateMany({
            where : { userId, isRead : false },
            data : { isRead : true }
        })
    }

}