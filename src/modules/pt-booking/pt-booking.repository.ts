import { PrismaClient } from '@prisma/client'

export class PtBookingRepository {
    constructor(private readonly prisma: PrismaClient) { }

    //Tim hop dong PT dang hoat dong cua khach hang cua khach hang
    // Tìm hợp đồng PT đang hoạt động của khách hàng
    public async findActiveAssignment(userId: number) {
        return this.prisma.coachAssignment.findFirst({
            where: {
                userId,
                status: 'ACTIVE',
                endDate: { gte: new Date() }
            },
            include: {
                // 1. Lấy thông tin huấn luyện viên và tài khoản User tương ứng
                coach: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true,
                                phone: true,
                                avatarUrl: true
                            }
                        },
                    }
                },
                // 2. Thêm dòng này để lấy thông tin chi tiết gói tập (ptPackage) của hội viên
                ptPackage: true
            }
        });
    }

    //Lay danh sach hoc vien dang hoat dong cua 1 PT
    public async findCoachStudents(coachUserId: number) {
        return this.prisma.coachAssignment.findMany({
            where: {
                coach: { userId: coachUserId },
                status: "ACTIVE"
            },
            include: {
                user: { select: { name: true, phone: true, email: true } },
            },
        })
    }

    //Tao hop dong PT va hoa don
    public async createAssignmentAndPayment(
        userId: number,
        coachId: number,
        ptPackageId: number,
        totalSessions: number,
        pricePaid: number,
        method: any
    ) {
        return this.prisma.$transaction(async (tx) => {
            const assignment = await tx.coachAssignment.create({
                data: {
                    userId,
                    coachId,
                    ptPackageId,
                    totalSessions,
                    remainingSessions: totalSessions,
                    pricePaid,
                    startDate: new Date(),
                    endDate: new Date(),
                    status: "PENDING",
                }
            });

            const payment = await tx.payment.create({
                data: {
                    user_id: userId,
                    coach_assignment_id: assignment.id,
                    amount: pricePaid,
                    method: method,
                    status: "PENDING"
                }
            });

            return { assignment, payment };
        })
    }

    //Cap nhat truc tiep PT moi va so tien hoa don khi chua thanh toan neu doi PT
    public async updateUnpaidAssignmentCoach(assignmentId: number, newCoachId: number, newPrice: number) {
        return this.prisma.$transaction(async (tx) => {
            //Doi PT moi va gia tien moi cua PT do
            const assignment = await tx.coachAssignment.update({
                where: { id: assignmentId, status: "PENDING" },
                data: { coachId: newCoachId, pricePaid: newPrice }
            });

            //Cap nhat lai so tien can dong tren hoa don PENDING di kem
            await tx.payment.updateMany({
                where: { coach_assignment_id: assignmentId, status: "PENDING" },
                data: { amount: newPrice },
            });

            //Lay hoa don de cap nhat
            const payment = await tx.payment.findFirst({
                where: { coach_assignment_id: assignmentId, status: "PENDING" }
            });

            return { assignment, payment };
        })
    }

    //Xac nhan da thanh toan va chuyen trang thai sang ACTIVE
    public async activateAssigment(paymentId: number, transactionRef: string, durationDays: number, gatewayResponse?: any) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    transaction_ref: transactionRef,
                    gateway_response: gatewayResponse ?? null
                }
            });

            if (!payment.coach_assignment_id) {
                throw new Error("PAYMENT_NOT_PT_ASSIGNMENT");
            }

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + durationDays);

            const assignment = await tx.coachAssignment.update({
                where: { id: payment.coach_assignment_id },
                data: {
                    status: "ACTIVE",
                    startDate,
                    endDate
                }
            });

            return { payment, assignment };
        });
    }

    //Tìm hóa đơn bằng ID
    public async findPaymentById(id: number) {
        return this.prisma.payment.findUnique({
            where: { id },
            include: { coachAssignment: { include: { ptPackage: true } } }
        });
    }

    // Tìm hợp đồng PT bằng ID
    public async findAssignmentById(id: number) {
        return this.prisma.coachAssignment.findUnique({
            where: { id }
        });
    }

    // CHỐNG SPAM: Tìm hợp đồng PT đang ở trạng thái PENDING của khách hàng
    public async findPendingAssignment(userId: number) {
        return this.prisma.coachAssignment.findFirst({
            where: {
                userId,
                status: "PENDING"
            }
        });
    }

    //Tao yeu cau doi PT
    public async createChangeRequest(userId: number, assignmentId: number, oldCoachId: number, newCoachId: number, reason: string) {
        return this.prisma.coachChangeRequest.create({
            data: {
                userId,
                assignmentId,
                oldCoachId,
                newCoachId,
                reason,
                status: "PENDING"
            }
        });
    }

    public async findChangeRequestById(id: number) {
        return this.prisma.coachChangeRequest.findUnique({
            where: { id }
        })
    }

    //Cap nhat trang thai yeu cau doi PT
    public async updateChangeRequestStatus(id: number, status: string) {
        return this.prisma.coachChangeRequest.update({
            where: { id },
            data: { status }
        });
    }

    //ADMIN/STAFF co the doi truc tiep PT
    public async updateCoachAssignmentCoach(assignmentId: number, userId: number, oldCoachId: number, newCoachId: number) {
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.coachAssignment.update({
                where: { id: assignmentId },
                data: { coachId: newCoachId }
            });

            //Xoa lich hen chua tap cua PT cu
            await tx.workoutSession.deleteMany({
                where: {
                    userId,
                    coachId: oldCoachId,
                    status: "PLANNED"
                },
            });

            return updated;
        });
    }
    //Hoi vien tu huy don dang ky chua thanh toan
    public async cancelPendingAssigment(assignmentId: number, userId: number) {
        return this.prisma.$transaction(async (tx) => {
            const assignment = await tx.coachAssignment.update({
                where: { id: assignmentId, userId, status: "PENDING" },
                data: { status: "CANCELLED" }
            });

            await tx.payment.updateMany({
                where: { coach_assignment_id: assignmentId, status: "PENDING" },
                data: { status: "FAILED" }
            });

            return assignment;
        })
    }

    //Kiem tra xem da co yeu cau doi PT nao dang PENDING cho hop dong nay chua
    public async findPendingChangeRequest(assignmentId: number) {
        return this.prisma.coachChangeRequest.findFirst({
            where: {
                assignmentId,
                status: "PENDING"
            }
        });
    }
}