import { PtPackageRepository } from './../pt-package/pt-package.repository';
import { PtBookingRepository } from './pt-booking.repository';
import { HirePtDto, RequestCoachChangeDto, AdminDirectChangeCoachDto } from './pt-booking.dto';
import { redisService } from '../../services/redis.service';

export class PtBookingService {
    constructor(
        private readonly repository: PtBookingRepository,
        private readonly ptPackageRepository: PtPackageRepository
    ) { }

    //Dang ky thue PT
    public async hirePT(userId: number, dto: HirePtDto) {
        //Kiem tra xem hoi vien co don hang nao dang cho thanh  toan khong chong SPAM
        const pending = await this.repository.findPendingAssignment(userId);
        if (pending) {
            throw new Error("HAVE_PENDING_ASSIGNMENT_LIMIT");
        }

        //Kiem tra hoi vien da co PT dang hoat dong hay chua
        const active = await this.repository.findActiveAssignment(userId);
        if (active) throw new Error("ALREADY_HAVE_ACTIVE_COACH");

        //Kiem tra xem PT co cung cap goi nay khong va lay don gia
        const customPrice = await this.ptPackageRepository.findSpecificPrice(dto.coachId, dto.ptPackageId);
        if (!customPrice || !customPrice.isActive) {
            throw new Error("COACH_DOES_NOT_OFFER_PACKAGE");
        }

        const ptPackage = await this.ptPackageRepository.findById(dto.ptPackageId);
        if (!ptPackage) throw new Error("PACKAGE_NOT_FOUND");

        const { assignment, payment } = await this.repository.createAssignmentAndPayment(
            userId,
            dto.coachId,
            dto.ptPackageId,
            ptPackage.numberOfSessions,
            Number(customPrice.price),
            dto.paymentMethod
        );

        return {
            assignmentId: assignment.id,
            paymentId: payment.id,
            amount: payment.amount,
            membershipId: null
        }
    }

    //Lay thong tin PT hien tai
    public async getMyActiveCoach(userId: number) {
        const redisKey = redisService.key("pt_assignment:active", userId);
        const cached = await redisService.get(redisKey);

        if (cached) return JSON.parse(cached);

        const assignment = await this.repository.findActiveAssignment(userId);
        if (assignment) {
            const ttl = Math.max(0, Math.ceil((assignment.endDate.getTime() - Date.now()) / 1000));
            if (ttl > 0) {
                await redisService.set(redisKey, JSON.stringify(assignment), ttl);
            }
        }

        return assignment;
    }

    //PT lay danh sach hoc vien
    public async getMyStudents(userId: number, role: string) {
        if (role !== 'COACH') throw new Error("FORBIDDEN");
        return this.repository.findCoachStudents(userId);
    }

    //Xac nhan hoa don va kich hoat hop dong
    public async confirmPayment(role: string, paymentId: number, transactionRef: string = "CASH_PAYMENT", gatewayResponse?: any) {
        if (role !== "ADMIN" && role !== "STAFF") {
            throw new Error("FORBIDDEN");
        }

        const payment = await this.repository.findPaymentById(paymentId);
        if (!payment) throw new Error("PAYMENT_NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("PAYMENT_ALREADY_PROCESSED");

        const durationDays = payment.coachAssignment?.ptPackage?.durationDays ?? 365;
        const result = await this.repository.activateAssigment(paymentId, transactionRef, durationDays, gatewayResponse);

        const redisKey = redisService.key("pt_assignment:active", result.assignment.userId);

        const ttl = durationDays * 24 * 60 * 60;
        await redisService.set(redisKey, JSON.stringify(result.assignment), ttl);

        return result;
    }

    //Doi PT danh cho hoi vien (Doi truc tiep neu chua thanh toan, tao request cho duyet neu da thanh toan)
    public async requestOrExecuteCoachChange(userId: number, dto: RequestCoachChangeDto) {
        const assignment = await this.repository.findAssignmentById(dto.assignmentId);

        if (!assignment || assignment.userId !== userId) {
            throw new Error("ASSIGNMENT_NOT_FOUND");
        }

        const newCoachPrice = await this.ptPackageRepository.findSpecificPrice(dto.newCoachId, assignment.ptPackageId);
        if (!newCoachPrice || !newCoachPrice.isActive) {
            throw new Error("NEW_COACH_DOES_NOT_OFFER_PACKAGE");
        }

        //Neu chua thanh toan doi truc tiep luon
        if (assignment.status === "PENDING") {
            const { assignment: updatedAssignment, payment } = await this.repository.updateUnpaidAssignmentCoach(
                dto.assignmentId,
                dto.newCoachId,
                Number(newCoachPrice.price)
            );
            return {
                isDirectChange: true,
                message: "Đã đổi huấn luyện viên trực tiếp thành công. Vui lòng thanh toán hóa đơn mới",
                assignmentId: updatedAssignment.id,
                payment
            };
        }

        //Neu da thanh toan can tao yeu cau phe duyet 
        if (assignment.status === "ACTIVE") {
            if (assignment.remainingSessions !== assignment.totalSessions) {
                throw new Error("MEMBER_ALREADY_TRAINED_SESSIONS");
            }
            //Khong cho doi yeu cau phe duyet trung lap
            const existingRequest = await this.repository.findPendingChangeRequest(dto.assignmentId);

            if (existingRequest) throw new Error("ALREADY_HAVE_PENDING_CHANGE_REQUEST");

            if (!dto.reason) throw new Error("REASON_REQUIRED_FOR_ACTIVE_ASSIGNMENT");

            const request = await this.repository.createChangeRequest(
                userId,
                dto.assignmentId,
                assignment.coachId,
                dto.newCoachId,
                dto.reason
            );

            return {
                isDirectChange: false,
                message: "Gửi yêu cầu đổi PT thành công. Vui lòng chờ phê duyệt.",
                requestId: request.id
            }
        }
        throw new Error("INVALID_ASSIGNMENT_STATUS");
    }

    //Hoi vien co the huy don dang ky PT neu chua thanh toan
    public async cancelMyPendingBooking(userId: number, assignmentId: number) {
        const assignment = await this.repository.findAssignmentById(userId);

        if (!assignment || assignment.userId !== userId) {
            throw new Error("ASSIGNMENT_NOT_FOUND");
        }

        if (assignment.status !== "PENDING") throw new Error("CANNOT_CANCEL_NON_PENDING_ASSIGNMENT");
    }

    //Admin hoac Staff co the truc tiep doi PT
    public async adminDirectChangeCoach(role: string, dto: AdminDirectChangeCoachDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') throw new Error("FORBIDDEN");

        const assignment = await this.repository.findAssignmentById(dto.assignmentId);
        if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");

        const newCoachPrice = await this.ptPackageRepository.findSpecificPrice(dto.newCoachId, assignment.ptPackageId);

        if (!newCoachPrice || !newCoachPrice.isActive) {
            throw new Error("NEW_COACH_DOES_NOT_OFFER_PACKAGE");
        }

        const result = await this.repository.updateCoachAssignmentCoach(
            dto.assignmentId,
            assignment.userId,
            assignment.coachId,
            dto.newCoachId
        );

        const redisKey = redisService.key("pt_assignment:active", assignment.userId);
        await redisService.del(redisKey);

        return result;
    }


    //Admin/Staff phe duyet yeu cau
    public async adminProcessChangeRequest(role: string, requestId: number, approve: boolean) {
        if (role !== 'ADMIN' && role !== 'STAFF') throw new Error('FORBIDDEN');

        const request = await this.repository.findChangeRequestById(requestId);

        if (!request || request.status !== "PENDING") throw new Error("REQUEST_NOT_FOUND_OR_PROCESSED");

        if (approve) {
            await this.repository.updateCoachAssignmentCoach(
                request.assignmentId,
                request.userId,
                request.oldCoachId,
                request.newCoachId
            );

            await this.repository.updateChangeRequestStatus(requestId, "APPROVED");

            const redisKey = redisService.key("pt_assignment:active", request.userId);
            await redisService.del(redisKey);
        }else {
            await this.repository.updateChangeRequestStatus(requestId, "REJECTED");
        }
        return { success : true };
    }
}