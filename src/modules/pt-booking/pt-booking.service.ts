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

    // Xac nhan hoa don va kich hoat hop dong (ho tro ca thue moi va dong chenh lech)
    public async confirmPayment(role : string, paymentId : number, transactionRef: string = "CASH_PAYMENT", gatewayResponse? : any) {
        if (role !== "ADMIN" && role !== "STAFF" && role !== "SYSTEM") {
            throw new Error("FORBIDDEN");
        }

        const payment = await this.repository.findPaymentById(paymentId);
        if (!payment) throw new Error("PAYMENT_NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("PAYMENT_ALREADY_PROCESSED");

        let resultAssignment = null;

        // Kiem tra xem hoa don nay co lien ket voi yeu cau doi PT/Goi tap nao khong
        const changeRequest = await this.repository.findChangeRequestByPaymentId(paymentId);

        if (changeRequest) {
            // Day la hoa don dong tien chenh lech nang cap goi!
            const newPtPackage = changeRequest.newPtPackageId 
                ? await this.ptPackageRepository.findById(changeRequest.newPtPackageId)
                : null;
            const newSessions = newPtPackage 
                ? newPtPackage.numberOfSessions 
                : (payment.coachAssignment?.totalSessions ?? 12);
            
            const currentAssignmentPrice = Number(payment.coachAssignment?.pricePaid ?? 0);
            const totalNewPrice = currentAssignmentPrice + Number(payment.amount);

            // Kich hoat doi PT va doi goi tap
            resultAssignment = await this.repository.executeCoachAndPackageChange(
                changeRequest.id,
                newSessions,
                totalNewPrice,
                transactionRef,
                gatewayResponse
            );
        } else {
            // Day la hoa don dang ky thue PT binh thuong
            const durationDays = payment.coachAssignment?.ptPackage?.durationDays ?? 30;
            const res = await this.repository.activateAssignment(paymentId, transactionRef, durationDays, gatewayResponse);
            resultAssignment = res.assignment;
        }

        // Xoa cache cu tren Redis cua hoi vien
        const redisKey = redisService.key("pt_assignment:active", resultAssignment.userId);
        await redisService.del(redisKey);

        return resultAssignment;
    }

    // Doi PT danh cho hoi vien (Doi truc tiep neu chua thanh toan, tao request cho duyet neu da thanh toan)
    public async requestOrExecuteCoachChange(userId: number, assignmentId: number, dto: RequestCoachChangeDto) {
        const assignment = await this.repository.findAssignmentById(assignmentId);
        if (!assignment || assignment.userId !== userId) {
            throw new Error("ASSIGNMENT_NOT_FOUND");
        }
        const targetPackageId = dto.newPtPackageId ?? assignment.ptPackageId;
        const newCoachPrice = await this.ptPackageRepository.findSpecificPrice(dto.newCoachId, targetPackageId);
        if (!newCoachPrice || !newCoachPrice.isActive) {
            throw new Error("NEW_COACH_DOES_NOT_OFFER_PACKAGE");
        }
        const targetPackage = await this.ptPackageRepository.findById(targetPackageId);
        if (!targetPackage) throw new Error("PACKAGE_NOT_FOUND");
        
        // TH 1: CHƯA THANH TOÁN (PENDING) -> Đổi trực tiếp luôn (không cần duyệt)
        if (assignment.status === "PENDING") {
            const { assignment: updatedAssignment, payment } = await this.repository.updateUnpaidAssignmentCoach(
                assignmentId,
                dto.newCoachId,
                Number(newCoachPrice.price)
            );
            return {
                isDirectChange: true,
                message: "Đã đổi PT trực tiếp thành công. Vui lòng thanh toán hóa đơn mới.",
                assignmentId: updatedAssignment.id,
                payment
            };
        }
        // TH 2: ĐÃ THANH TOÁN (ACTIVE) -> Tạo yêu cầu chờ Admin duyệt (Chưa tạo Payment)
        if (assignment.status === "ACTIVE") {
            if (assignment.remainingSessions !== assignment.totalSessions) {
                throw new Error("MEMBER_ALREADY_TRAINED_SESSIONS");
            }
            const existingRequest = await this.repository.findPendingChangeRequest(assignmentId);
            if (existingRequest) {
                throw new Error("ALREADY_HAVE_PENDING_CHANGE_REQUEST");
            }
            // Tính số tiền chênh lệch
            const priceDifference = Number(newCoachPrice.price) - Number(assignment.pricePaid);
            if (priceDifference < 0) {
                throw new Error("DOWNGRADE_NOT_SUPPORTED");
            }
            // Chỉ tạo yêu cầu đổi (không tạo Payment PENDING lúc này)
            const request = await this.repository.createChangeRequestWithPackage(
                userId,
                assignmentId,
                assignment.coachId,
                dto.newCoachId,
                targetPackageId,
                priceDifference,
                dto.paymentMethod,
                dto.reason || "Yêu cầu đổi PT/Gói tập"
            );
            return {
                isDirectChange: false,
                needPayment: false,
                message: "Gửi yêu cầu đổi thành công. Vui lòng chờ phê duyệt từ Admin/Staff.",
                requestId: request.id
            };
        }
        throw new Error("INVALID_ASSIGNMENT_STATUS");
    }

    // Hoi vien co the huy don dang ky PT neu chua thanh toan
    public async cancelMyPendingBooking(userId: number, assignmentId: number) {
        const assignment = await this.repository.findAssignmentById(assignmentId);

        if (!assignment || assignment.userId !== userId) {
            throw new Error("ASSIGNMENT_NOT_FOUND");
        }

        if (assignment.status !== "PENDING") throw new Error("CANNOT_CANCEL_NON_PENDING_ASSIGNMENT");

        return this.repository.cancelPendingAssigment(assignmentId, userId);
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


    // Admin/Staff phe duyet yeu cau doi PT (co ho tro tao hoa don neu phai dong them)
        // 1. Admin/Staff phê duyệt yêu cầu đổi PT (Không yêu cầu chọn phương thức thanh toán)
    public async adminProcessChangeRequest(role: string, requestId: number, approve: boolean) {
        if (role !== 'ADMIN' && role !== 'STAFF') throw new Error("FORBIDDEN");
        const request = await this.repository.findChangeRequestById(requestId);
        if (!request || request.status !== "PENDING") {
            throw new Error("REQUEST_NOT_FOUND_OR_PROCESSED");
        }
        
        // Nếu Admin Từ chối:
        if (!approve) {
            await this.repository.updateChangeRequestStatus(requestId, "REJECTED");
            return { status: "REJECTED", message: "Đã từ chối yêu cầu đổi PT." };
        }

        // Nếu Admin Đồng ý:
        const priceDifference = Number(request.priceDifference);

        // Trường hợp 1: Đổi ngang giá (Tiền chênh lệch === 0) -> Kích hoạt đổi PT ngay lập tức
        if (priceDifference === 0) {
            const newPtPackage = request.newPtPackageId 
                ? await this.ptPackageRepository.findById(request.newPtPackageId)
                : null;
            const newSessions = newPtPackage ? newPtPackage.numberOfSessions : 12;
            
            const assignment = await this.repository.findAssignmentById(request.assignmentId);
            
            const resultAssignment = await this.repository.executeCoachAndPackageChange(
                requestId,
                newSessions,
                Number(assignment?.pricePaid ?? 0),
                `UPGRADE_APPROVED_BY_${role}`
            );

            // Xóa cache cũ trên Redis của hội viên
            const redisKey = redisService.key("pt_assignment:active", resultAssignment.userId);
            await redisService.del(redisKey);

            return { 
                status: "APPROVED", 
                message: `Phê duyệt thành công. PT đã được đổi trực tiếp do không chênh lệch giá.` 
            };
        }

        // Trường hợp 2: Đổi sang gói đắt hơn (Tiền chênh lệch > 0) -> Tự động tạo hóa đơn chênh lệch PENDING
        const { payment } = await this.repository.createPendingUpgradePayment(requestId);

        return {
            status: "AWAITING_PAYMENT",
            message: `Yêu cầu đổi PT đã được duyệt. Tạo hóa đơn đóng tiền chênh lệch thành công: ${priceDifference} VND.`,
            payment
        };
    }

    // Lay toan bo yeu cau doi PT (Admin/Staff)
    public async getChangeRequests(role: string, status?: string) {
        if (role !== "ADMIN" && role !== "STAFF") {
            throw new Error("FORBIDDEN");
        }
        return this.repository.findChangeRequests(status);
    }

    // Lay danh sach dang ky thue PT cua 1 hoi vien
    public async getMyAssignments(userId: number) {
        return this.repository.findUserAssignments(userId);
    }

    // Admin lay toan bo hop dong thue PT cua he thong
    public async adminGetAssignments(role: string, status?: string) {
        if (role !== "ADMIN" && role !== "STAFF") {
            throw new Error("FORBIDDEN");
        }
        return this.repository.findAllAssignments(status);
    }
}