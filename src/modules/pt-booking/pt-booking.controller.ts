import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { PtBookingService } from './pt-booking.service';
import { PtBookingRepository } from './pt-booking.repository';
import { PtPackageRepository } from '../pt-package/pt-package.repository';
import { prisma } from '../../config/client';

const repository = new PtBookingRepository(prisma);
const packageRepo = new PtPackageRepository(prisma);
const service = new PtBookingService(repository, packageRepo);

const mapError = (msg: string) => {
    switch (msg) {
        case "HAVE_PENDING_ASSIGNMENT_LIMIT": 
            return { status: 400, message: "Bạn đang có một đăng ký thuê PT chờ thanh toán. Vui lòng thanh toán hoặc hủy đơn cũ trước khi tạo đơn mới." };
        case "ALREADY_HAVE_ACTIVE_COACH": 
            return { status: 400, message: "Bạn đang có huấn luyện viên hỗ trợ hoạt động." };
        case "COACH_DOES_NOT_OFFER_PACKAGE": 
            return { status: 400, message: "Huấn luyện viên không nhận gói combo này hoặc chưa có bảng giá." };
        case "PACKAGE_NOT_FOUND": 
            return { status: 404, message: "Không tìm thấy gói combo PT yêu cầu." };
        case "PAYMENT_NOT_FOUND": 
            return { status: 404, message: "Không tìm thấy hóa đơn thanh toán." };
        case "PAYMENT_ALREADY_PROCESSED": 
            return { status: 400, message: "Hóa đơn này đã được xác nhận thanh toán." };
        case "ASSIGNMENT_NOT_FOUND": 
            return { status: 404, message: "Không tìm thấy hợp đồng PT." };
        case "ASSIGNMENT_NOT_ACTIVE": 
            return { status: 400, message: "Hợp đồng PT này không ở trạng thái kích hoạt." };
        case "MEMBER_ALREADY_TRAINED_SESSIONS": 
            return { status: 400, message: "Không thể đổi PT vì hội viên đã thực hiện buổi tập." };
        case "NEW_COACH_DOES_NOT_OFFER_PACKAGE": 
            return { status: 400, message: "Huấn luyện viên mới không nhận gói tập này." };
        case "REASON_REQUIRED_FOR_ACTIVE_ASSIGNMENT":
            return { status: 400, message: "Vui lòng nhập lý do yêu cầu đổi huấn luyện viên." };
        case "ALREADY_HAVE_PENDING_CHANGE_REQUEST": 
            return { status: 400, message: "Bạn đang có một yêu cầu đổi huấn luyện viên chờ duyệt. Vui lòng không gửi trùng lặp." };
        case "REQUEST_NOT_FOUND_OR_PROCESSED": 
            return { status: 400, message: "Yêu cầu đổi PT không tồn tại hoặc đã được xử lý." };
        case "CANNOT_CANCEL_NON_PENDING_ASSIGNMENT":
            return { status: 400, message: "Chỉ được phép hủy đơn hàng chưa thanh toán." };
        case "FORBIDDEN": 
            return { status: 403, message: "Bạn không có quyền thực hiện hành động này." };
        case "DOWNGRADE_NOT_SUPPORTED": 
            return { 
                status: 400, 
                message: "Hệ thống không hỗ trợ đổi sang gói tập có giá trị thấp hơn gói hiện tại. Vui lòng liên hệ ban quản lý phòng gym để được hỗ trợ thủ công." 
            };
        default: 
            return { status: 500, message: "Lỗi hệ thống. Vui lòng thử lại sau." };
    }
};

export const hirePt = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");

        // 1. Chỉ gọi service đăng ký thuê PT để tạo Hợp đồng (PENDING) và Hóa đơn (PENDING)
        const result = await service.hirePT(userId, req.body);

        // 2. Trả về thông tin hóa đơn cho Frontend để Frontend tự gọi tiếp API thanh toán chung
        res.status(201).json({
            success: true,
            message: "Đăng ký thuê PT thành công. Vui lòng tiến hành thanh toán.",
            data: { 
                assignmentId: result.assignmentId,
                paymentId: result.paymentId,
                amount: result.amount
            }
        });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const getMyActiveCoach = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");

        const data = await service.getMyActiveCoach(userId);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
};

export const getMyStudents = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId || !role) throw new Error("FORBIDDEN");

        const data = await service.getMyStudents(userId, role);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};


export const requestOrExecuteCoachChange = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");

        const assignmentId = parseInt(req.params.assignmentId as string, 10);
        if (isNaN(assignmentId)) {
            return res.status(400).json({ success: false, message: "Mã hợp đồng PT không hợp lệ." });
        }

        // Gọi Service thực hiện đổi trực tiếp (chưa thanh toán) hoặc gửi yêu cầu chờ Admin duyệt (đã thanh toán)
        const result = await service.requestOrExecuteCoachChange(userId, assignmentId, req.body);

        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                isDirectChange: result.isDirectChange,
                assignmentId: result.assignmentId || null,
                requestId: result.requestId || null,
                paymentId: result.payment ? result.payment.id : null
            }
        });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const cancelMyBooking = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");
        const assignmentId = parseInt(req.params.id as string, 10);

        await service.cancelMyPendingBooking(userId, assignmentId);
        res.status(200).json({ success: true, message: "Hủy đơn đăng ký thuê PT thành công." });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const adminDirectChangeCoach = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const data = await service.adminDirectChangeCoach(role, req.body);
        res.status(200).json({ success: true, message: "Thay đổi huấn luyện viên trực tiếp thành công.", data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// Admin/Staff phê duyệt yêu cầu đổi PT (Chỉ đồng ý hoặc từ chối)
export const adminProcessChangeRequest = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");
        const requestId = parseInt(req.params.requestId as string, 10);
        const approve = req.body.approve === true; // true = đồng ý duyệt, false = từ chối

        const result = await service.adminProcessChangeRequest(role, requestId, approve);
        
        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                status: result.status,
                paymentId: (result as any).payment ? (result as any).payment.id : null
            }
        });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};


// Admin/Staff xem danh sách yêu cầu đổi PT
export const getChangeRequests = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const status = req.query.status as string | undefined;
        const data = await service.getChangeRequests(role, req.user?.branchId, status);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// Hội viên xem lịch sử/đăng ký thuê PT của mình
export const getMyAssignments = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");

        const data = await service.getMyAssignments(userId);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// Admin/Staff xem toàn bộ hợp đồng thuê PT của hệ thống
export const adminGetAssignments = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const status = req.query.status as string | undefined;
        const data = await service.adminGetAssignments(role, req.user?.branchId, status);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};