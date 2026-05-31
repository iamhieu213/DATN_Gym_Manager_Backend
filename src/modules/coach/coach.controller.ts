import { Request, Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { CoachService } from './coach.service'
import { CoachRepository } from './coach.repository'
import { prisma } from "../../config/client"

const coachRepository = new CoachRepository(prisma);
const coachService = new CoachService(coachRepository);

const mapError = (msg: string) => {
    switch (msg) {
        case "COACH_NOT_FOUND": return { status: 404, message: "Không tìm thấy hồ sơ huấn luyện viên." };
        case "COACH_PROFILE_NOT_FOUND": return { status: 404, message: "Tài khoản của bạn chưa có hồ sơ huấn luyện viên." };
        case "COACH_PROFILE_ALREADY_EXISTS": return { status: 400, message: "Hồ sơ của huấn luyện viên này đã tồn tại." };
        case "MISSING_REQUIRED_FIELDS": return { status: 400, message: "Vui lòng nhập đầy đủ các trường bắt buộc." };
        case "FORBIDDEN": return { status: 403, message: "Bạn không có quyền thực hiện chức năng này." };
        default: return { status: 500, message: "Lỗi hệ thống. Vui lòng thử lại sau." };
    }
};

export const getAllCoaches = async (req: Request, res: Response) => {
    try {
        const result = await coachService.getAllCoaches(req.query)
        res.status(200).json({ success: true, ...result });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({
            success: false,
            message: error.message
        });
    }
}

export const getCoach = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);
        const result = await coachService.getCoachById(id);
        res.status(200).json({ success: true, data: result });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const getMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        // Chỉ cho phép tài khoản có vai trò COACH truy cập
        if (!userId || role !== 'COACH') throw new Error("FORBIDDEN");
        const result = await coachService.getMyProfile(userId);
        res.status(200).json({ success: true, data: result });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const getMyAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        // Chỉ cho phép tài khoản có vai trò COACH truy cập
        if (!userId || role !== 'COACH') throw new Error("FORBIDDEN");
        const result = await coachService.getMyAvailability(userId);
        res.status(200).json({ success: true, data: result });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 1. Admin lấy danh sách toàn bộ PT để quản trị
export const getCoachesForAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const queryParams = req.query as unknown as any; // Cast tạm sang any để gửi vào Service
        const result = await coachService.getAllCoachesForAdmin(role, queryParams);
        
        res.status(200).json({ success: true, ...result });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 2. Admin bật/tắt trạng thái hoạt động của PT
export const updateCoachStatusByAdmin = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const coachId = parseInt(req.params.id as string, 10);
        const { isAvailable } = req.body;

        if (isAvailable === undefined) throw new Error("MISSING_REQUIRED_FIELDS");

        const result = await coachService.updateCoachStatusByAdmin(role, coachId, isAvailable);
        res.status(200).json({ success: true, message: "Cập nhật trạng thái PT thành công.", data: result });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const updateMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId || !role) throw new Error("FORBIDDEN");

        const result = await coachService.updateMyProfile(userId, role, req.body);
        res.status(200).json({ success: true, message: "Cập nhật hồ sơ thành công.", data: result });

    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
}

export const updateMyAvailability = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId || !role) throw new Error("FORBIDDEN");
        await coachService.setMyAvailability(userId, role, req.body);
        res.status(200).json({ success: true, message: "Cập nhật lịch làm việc rảnh thành công." });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

