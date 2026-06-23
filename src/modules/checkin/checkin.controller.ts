import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { CheckInService } from "./checkin.service";
import { CheckInRepository } from "./checkin.repository";
import { prisma } from "../../config/client";
import { CheckInDto, ListCheckInQueryDto } from "./checkin.dto";

const repository = new CheckInRepository(prisma);
const checkInService = new CheckInService(repository);

const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "USER_NOT_FOUND":
            return 404;
        case "NO_ACTIVE_MEMBERSHIP":
        case "MEMBERSHIP_EXPIRED":
        case "BAD_REQUEST":
        case "STAFF_BRANCH_REQUIRED":
        case "ADMIN_MUST_SPECIFY_BRANCH":
            return 400;
        default:
            return 500;
    }
};

const mapErrorMessage = (code: string): string => {
    switch (code) {
        case "UNAUTHORIZED":
            return "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.";
        case "FORBIDDEN":
            return "Bạn không có quyền thực hiện chức năng này.";
        case "USER_NOT_FOUND":
            return "Không tìm thấy thông tin hội viên ứng với số điện thoại này.";
        case "NO_ACTIVE_MEMBERSHIP":
            return "Hội viên chưa đăng ký hoặc không có gói tập nào đang hoạt động.";
        case "MEMBERSHIP_EXPIRED":
            return "Gói tập của hội viên đã hết hạn sử dụng. Vui lòng gia hạn thêm.";
        case "STAFF_BRANCH_REQUIRED":
            return "Tài khoản nhân viên chưa được gán chi nhánh để thực hiện điểm danh.";
        case "ADMIN_MUST_SPECIFY_BRANCH":
            return "Vui lòng chỉ định rõ chi nhánh thực hiện điểm danh (đối với tài khoản Admin).";
        default:
            return "Đã xảy ra lỗi hệ thống khi điểm danh. Vui lòng thử lại sau.";
    }
};

// 1. API Lễ tân quét/nhập check-in bằng SĐT
export const checkInByPhone = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) throw new Error("UNAUTHORIZED");
        const staffRole = user.role;
        const staffBranchId = user.branchId;

        // Chỉ cho phép ADMIN hoặc STAFF thực hiện check-in cho hội viên
        if (staffRole !== "ADMIN" && staffRole !== "STAFF") {
            throw new Error("FORBIDDEN");
        }
        const { phone } = req.body as CheckInDto;
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Số điện thoại không được để trống.",
                error: "BAD_REQUEST"
            });
        }

        // LẤY VÀ KIỂM TRA BRANCHID CHO LƯỢT CHECK-IN
        let targetBranchId: number | null = staffBranchId ?? null;
        if (staffRole === "ADMIN") {
            // Admin không có chi nhánh cố định -> bắt buộc phải chọn chi nhánh từ giao diện gửi lên
            targetBranchId = req.body.branchId ? Number(req.body.branchId) : null;
            if (!targetBranchId) {
                throw new Error("ADMIN_MUST_SPECIFY_BRANCH");
            }
        } else {
            // Staff -> Lấy chi nhánh gắn liền với tài khoản của Staff
            if (!targetBranchId) {
                throw new Error("STAFF_BRANCH_REQUIRED");
            }
        }

        const result = await checkInService.checkIn(phone, targetBranchId);

        res.status(200).json({
            success: true,
            message: `Chào mừng ${result.user.name} đến tập! Điểm danh thành công.`,
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 2. API Hội viên xem lịch sử điểm danh của chính mình
export const getMyHistory = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) throw new Error("UNAUTHORIZED");
        const userId = user.userId;

        const page = Number(req.query.page ?? 1);
        const limit = Number(req.query.limit ?? 10);

        const result = await checkInService.getMyHistory(userId, page, limit);

        res.status(200).json({
            success: true,
            message: "Lấy lịch sử đi tập thành công.",
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 3. API Admin/Staff xem lịch sử điểm danh phòng tập
export const getAllHistory = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) throw new Error("UNAUTHORIZED");
        const role = user.role;
        const branchId = user.branchId;

        const result = await checkInService.getAllHistory(role, branchId, req.query as ListCheckInQueryDto);

        res.status(200).json({
            success: true,
            message: "Lấy lịch sử điểm danh phòng tập thành công.",
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};