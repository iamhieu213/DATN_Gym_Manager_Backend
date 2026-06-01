import { PrismaClient, PaymentMethod, PaymentStatus } from '@prisma/client';

export class PaymentRepository {
    constructor(private readonly prisma: PrismaClient) { }

    // Tìm hóa đơn bằng ID kèm chi tiết
    public async findPaymentById(id: number) {
        return this.prisma.payment.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true } }
            }
        });
    }

    // Cập nhật trạng thái và phương thức thanh toán
    public async updatePayment(id: number, data: { status?: PaymentStatus; method?: PaymentMethod; transaction_ref?: string; gateway_response?: any; paid_at?: Date }) {
        return this.prisma.payment.update({
            where: { id },
            data
        });
    }

    // Lấy lịch sử giao dịch của hội viên
    public async findUserPayments(userId: number) {
        return this.prisma.payment.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: {
                membership: { include: { plan: true } },
                coachAssignment: { include: { ptPackage: true } }
            }
        });
    }

    // Admin xem toàn bộ giao dịch hệ thống
    public async findAllPayments(status?: PaymentStatus) {
        return this.prisma.payment.findMany({
            where: status ? { status } : {},
            orderBy: { created_at: 'desc' },
            include: {
                user: { select: { name: true, email: true, phone: true } },
                membership: { include: { plan: true } },
                coachAssignment: { include: { ptPackage: true } }
            }
        });
    }
}
