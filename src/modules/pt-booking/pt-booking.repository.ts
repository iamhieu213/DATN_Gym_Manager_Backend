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
    public async activateAssignment(paymentId: number, transactionRef: string, durationDays: number, gatewayResponse?: any, actorBranchId?: number | null) {
        return this.prisma.$transaction(async (tx) => {
            const payment = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'PAID',
                    paid_at: new Date(),
                    transaction_ref: transactionRef,
                    gateway_response: gatewayResponse ?? null,
                    ...(actorBranchId ? { branchId: actorBranchId } : {})
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

    //Tim yeu cau doi PT bang Id hoa don
    public async findChangeRequestByPaymentId(paymentId : number) {
        return this.prisma.coachChangeRequest.findFirst({
            where : { paymentId }
        });
    }

    // 1. Chỉ tạo yêu cầu đổi PT (Chưa tạo hóa đơn PENDING)
    public async createChangeRequestWithPackage(
        userId: number,
        assignmentId: number,
        oldCoachId: number,
        newCoachId: number,
        newPtPackageId: number | null,
        priceDifference: number,
        paymentMethod: any,
        reason: string
    ) {
        return this.prisma.coachChangeRequest.create({
            data: {
                userId,
                assignmentId,
                oldCoachId,
                newCoachId,
                newPtPackageId: newPtPackageId ?? null,
                priceDifference,
                paymentMethod,
                reason,
                status: "PENDING"
            }
        });
    }
    // 2. Tạo hóa đơn PENDING cho tiền chênh lệch và liên kết vào yêu cầu đổi PT (sau khi Admin duyệt đồng ý)
    public async createPendingUpgradePayment(requestId: number) {
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.coachChangeRequest.findUnique({
                where: { id: requestId }
            });
            if (!request) throw new Error("REQUEST_NOT_FOUND");
            // Tạo hóa đơn PENDING đóng thêm tiền
            const payment = await tx.payment.create({
                data: {
                    user_id: request.userId,
                    coach_assignment_id: request.assignmentId,
                    amount: request.priceDifference,
                    method: request.paymentMethod,
                    status: "PENDING"
                }
            });
            // Cập nhật liên kết hóa đơn vào yêu cầu và đổi trạng thái sang AWAITING_PAYMENT
            const updatedRequest = await tx.coachChangeRequest.update({
                where: { id: requestId },
                data: {
                    paymentId: payment.id,
                    status: "AWAITING_PAYMENT"
                }
            });
            return { request: updatedRequest, payment };
        });
    }
    // 3. TRANSACTION KÍCH HOẠT ĐỔI PT & GÓI TẬP: Khi tiền chênh lệch đã thanh toán thành công (hoặc khi đổi gói rẻ hơn/bằng tiền được duyệt trực tiếp)
    public async executeCoachAndPackageChange(
        requestId: number,
        newSessions: number,
        newPricePaid: number,
        transactionRef: string = "UPGRADE_ACTIVE",
        gatewayResponse?: any,
        actorBranchId?: number | null
    ) {
        return this.prisma.$transaction(async (tx) => {
            const request = await tx.coachChangeRequest.findUnique({
                where: { id: requestId }
            });
            if (!request) throw new Error("REQUEST_NOT_FOUND");
            const assignment = await tx.coachAssignment.findUnique({
                where: { id: request.assignmentId }
            });
            if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
            const targetPackageId = request.newPtPackageId ?? assignment.ptPackageId;
            // 1. Cập nhật PT mới, gói mới, reset số buổi tập và tổng tiền của hợp đồng PT
            const updatedAssignment = await tx.coachAssignment.update({
                where: { id: request.assignmentId },
                data: {
                    coachId: request.newCoachId,
                    ptPackageId: targetPackageId,
                    totalSessions: newSessions,
                    remainingSessions: newSessions, // reset lại số buổi của gói mới
                    pricePaid: newPricePaid // cập nhật tổng số tiền đã đóng thực tế
                }
            });
            // 2. Xóa lịch hẹn chưa tập của PT cũ
            await tx.workoutSession.deleteMany({
                where: {
                    userId: request.userId,
                    coachId: request.oldCoachId,
                    status: "PLANNED"
                }
            });
            // 3. Chuyển trạng thái yêu cầu đổi thành APPROVED (Hoàn tất)
            await tx.coachChangeRequest.update({
                where: { id: requestId },
                data: { status: "APPROVED" }
            });
            // 4. Cập nhật hóa đơn phụ (nếu có) thành PAID
            if (request.paymentId) {
                await tx.payment.update({
                    where: { id: request.paymentId },
                    data: {
                        status: "PAID",
                        paid_at: new Date(),
                        transaction_ref: transactionRef,
                        gateway_response: gatewayResponse ?? null,
                        ...(actorBranchId ? { branchId: actorBranchId } : {})
                    }
                });
            }
            return updatedAssignment;
        });
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

    // Lay tat ca yeu cau doi PT cua he thong
    public async findChangeRequests(where : any) {
        return this.prisma.coachChangeRequest.findMany({
            where: status ? { status } : {},
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                },
                oldCoach: {
                    include: {
                        user: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                newCoach: {
                    include: {
                        user: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                newPtPackage: true,
                payment: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    // Lay danh sach dang ky PT cua 1 hoi vien
    public async findUserAssignments(userId: number) {
        return this.prisma.coachAssignment.findMany({
            where: { userId },
            include: {
                coach: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                avatarUrl: true,
                                phone: true
                            }
                        }
                    }
                },
                ptPackage: true,
                payments: {
                    orderBy: { created_at: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    // Admin lay toan bo hop dong thue PT tren he thong
    public async findAllAssignments(where : any = {}) {
        return this.prisma.coachAssignment.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true
                    }
                },
                coach: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                phone: true,
                                branchId : true
                            }
                        }
                    }
                },
                ptPackage: true,
                payments: {
                    orderBy: { created_at: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}