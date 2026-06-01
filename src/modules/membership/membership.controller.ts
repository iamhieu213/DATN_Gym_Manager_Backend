import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { MembershipsService } from "./membership.service";
import { MembershipRepository } from "./membership.repository";
import { prisma } from "../../config/client";
import { BuyMembershipDto, UpgradeMembershipDto, ListMembershipQueryDto } from "./membership.dto";

const repository = new MembershipRepository(prisma);
const membershipsService = new MembershipsService(repository);

const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "PLAN_NOT_FOUND":
        case "PAYMENT_NOT_FOUND":
        case "MEMBERSHIP_NOT_FOUND":
            return 404;
        case "ALREADY_HAVE_ACTIVE_PLAN":
        case "NO_ACTIVE_PLAN_TO_UPGRADE":
        case "CANNOT_DOWNGRADE_OR_EQUAL":
        case "PAYMENT_ALREADY_PROCESSED":
        case "MEMBERSHIP_NOT_ACTIVE":
        case "BAD_REQUEST":
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
        case "PLAN_NOT_FOUND":
            return "Gói tập không hợp lệ hoặc đã ngừng hoạt động.";
        case "PAYMENT_NOT_FOUND":
            return "Không tìm thấy thông tin hóa đơn.";
        case "MEMBERSHIP_NOT_FOUND":
            return "Không tìm thấy đăng ký gói tập.";
        case "ALREADY_HAVE_ACTIVE_PLAN":
            return "Bạn đã có gói tập đang hoạt động. Vui lòng chọn nâng cấp gói nếu muốn thay đổi.";
        case "NO_ACTIVE_PLAN_TO_UPGRADE":
            return "Không tìm thấy gói tập đang hoạt động nào để thực hiện nâng cấp.";
        case "CANNOT_DOWNGRADE_OR_EQUAL":
            return "Chỉ được nâng cấp lên các gói tập có giá trị lớn hơn gói hiện tại.";
        case "PAYMENT_ALREADY_PROCESSED":
            return "Hóa đơn này đã hoàn tất thanh toán.";
        case "MEMBERSHIP_NOT_ACTIVE":
            return "Gói tập này hiện không ở trạng thái kích hoạt.";
        default:
            return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    }
};

export const buyMembership = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.buyMembership(userId, req.body as BuyMembershipDto);
 
        res.status(201).json({
            success: true,
            message: "Đăng ký mua gói tập thành công. Vui lòng thanh toán hóa đơn.",
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

export const upgradeMembership = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.upgradeMembership(userId, req.body as UpgradeMembershipDto);

        res.status(200).json({
            success: true,
            message: "Tạo yêu cầu nâng cấp thành công. Vui lòng thanh toán số tiền chênh lệch.",
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



export const cancelMembership = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("UNAUTHORIZED");

        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói đăng ký không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói đăng ký không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }

        const result = await membershipsService.cancelMembership(role, id);
        res.status(200).json({
            success: true,
            message: "Hủy gói tập của hội viên thành công.",
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

export const getActiveMembership = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.getActiveMembership(userId);
        res.status(200).json({
            success: true,
            message: "Lấy thông tin gói tập hiện tại thành công.",
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

export const getMyHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.getMyHistory(userId);
        res.status(200).json({
            success: true,
            message: "Lấy lịch sử mua gói tập thành công.",
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

export const getAllMemberships = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.getAllMemberships(role, req.query as ListMembershipQueryDto);
        res.status(200).json({
            success: true,
            message: "Lấy danh sách đăng ký gói tập thành công.",
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
