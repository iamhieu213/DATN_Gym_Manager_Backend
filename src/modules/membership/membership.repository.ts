import { UpgradeMembershipDto } from './membership.dto';
import { PrismaClient, PaymentMethod } from "@prisma/client";

export class MembershipRepository {
    constructor(private readonly prisma: PrismaClient) { }

    //Tim goi tap dang kich hoat cua 1 hoi vien
    async findActiveMembershipByUserId(userId: number) {
        return this.prisma.membership.findFirst({
            where: {
                user_id: userId,
                is_active: true,
                status: 'ACTIVE',
            },
            include: {
                plan: true,
            },
        });
    }

    //Lay thing tin goi tap
    async findPlanById(planId: number) {
        return this.prisma.plan.findUnique({
            where: { id: planId }
        });
    }

    //Lay thong tin hoa don tap
    async findPaymentById(paymentId: number) {
        return this.prisma.payment.findUnique({
            where: { id: paymentId },
            include: {
                membership: true
            }
        });
    }

    //Tim chi tiet goi tap dang ky cua 1 hoi vien
    async findMembershipById(id: number) {
        return this.prisma.membership.findUnique({
            where: { id },
            include: {
                user: { select: { name: true, email: true, phone: true } },
                plan: true,
            }
        });
    }

    // Phân trang danh sách đăng ký cho Admin/Staff
    async findMany(where: any, skip: number, take: number) {
        return this.prisma.membership.findMany({
            where,
            skip,
            take,
            orderBy: { created_at: 'desc' },
            include: {
                user: {
                    select: { id: true, name: true, email: true, phone: true }
                },
                plan: {
                    select: { id: true, name: true, price: true, duration_days: true }
                }
            }
        });
    }
    async count(where: any) {
        return this.prisma.membership.count({ where });
    }

    async createMembershipAndPayment(data: {
        userId: number,
        planId: number,
        startDate: Date,
        endDate: Date,
        amount: number,
        method: PaymentMethod,
    }) {
        return this.prisma.$transaction(async (tx) => {
            const membership = await tx.membership.create({
                data: {
                    user_id: data.userId,
                    plan_id: data.planId,
                    start_date: data.startDate,
                    end_date: data.endDate,
                    status: 'PENDING',
                    is_active: false
                }
            });

            const payment = await tx.payment.create({
                data: {
                    user_id: data.userId,
                    membership_id: membership.id,
                    plan_id: data.planId,
                    amount: data.amount,
                    method: data.method,
                    status: 'PENDING'
                }
            });
            return {
                membership, payment
            }
        });
    }

    //Thuc hien vo hien hoa goi cu va tao goi moi khi nang cap goi tap
    async upgradeMembershipAndPayment(data: {
        userId: number,
        activeMembershipId: number;
        newPlanId: number,
        startDate: Date,
        endDate: Date,
        amount: number,
        method: PaymentMethod
    }) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Tạo gói đăng ký nâng cấp ở dạng PENDING (Giữ gói hiện tại vẫn ACTIVE để hội viên sử dụng trong lúc chờ thanh toán)
            const newMembership = await tx.membership.create({
                data: {
                    user_id: data.userId,
                    plan_id: data.newPlanId,
                    start_date: data.startDate,
                    end_date: data.endDate,
                    status: 'PENDING',
                    is_active: false
                }
            });
            // 2. Tạo hóa đơn chênh lệch đóng thêm ở dạng PENDING
            const payment = await tx.payment.create({
                data: {
                    user_id: data.userId,
                    membership_id: newMembership.id,
                    plan_id: data.newPlanId,
                    amount: data.amount,
                    method: data.method,
                    status: 'PENDING'
                }
            });
            return { membership: newMembership, payment };
        });
    }

    // TRANSACTION: Kích hoạt gói tập khi đã đóng tiền thành công
    async activateMembershipPayment(paymentId: number, transactionRef: string, gatewayResponse: any) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    transaction_ref: transactionRef,
                    gateway_response: gatewayResponse
                }
            });

            // 1. Tìm gói active hiện tại của user (nếu có) và vô hiệu hóa / chuyển thành UPGRADED
            const activeMembership = await tx.membership.findFirst({
                where: {
                    user_id: payment.user_id,
                    is_active: true,
                    status: 'ACTIVE',
                    id: { not: payment.membership_id }
                }
            });

            if (activeMembership) {
                await tx.membership.update({
                    where: { id: activeMembership.id },
                    data: {
                        status: 'UPGRADED',
                        is_active: false,
                        end_date: new Date() // Kết thúc sớm vào ngày hôm nay
                    }
                });
            }

            // 2. Kích hoạt gói mới
            const membership = await tx.membership.update({
                where: { id: payment.membership_id },
                data: {
                    status: 'ACTIVE',
                    is_active: true
                },
                include: {
                    plan: true
                }
            });
            return { payment, membership };
        });
    }

    // Hủy gói tập của hội viên
    async cancelMembership(id: number) {
        return this.prisma.membership.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                is_active: false
            }
        });
    }
    // Xem lịch sử mua gói của 1 người
    async findUserHistory(userId: number) {
        return this.prisma.membership.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
            include: {
                plan: true,
                payments: true
            }
        });
    }

}