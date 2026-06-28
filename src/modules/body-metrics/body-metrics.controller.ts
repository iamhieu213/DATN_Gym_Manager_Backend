import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { BodyMetricsService } from "./body-metrics.service";
import { BodyMetricsRepository } from "./body-metrics.repository";
import { prisma } from "../../config/client";
import { CreateBodyMetricsDto, UpdateBodyMetricsDto, ListBodyMetricQueryDto } from "./body-metrics.dto";

const bodyMetricsRepository = new BodyMetricsRepository(prisma);
const bodyMetricsService = new BodyMetricsService(bodyMetricsRepository);

const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED": return 401;
        case "FORBIDDEN": return 403;
        case "METRIC_NOT_FOUND": return 404;
        case "MISSING_REQUIRED_FIELDS": return 400;
        default: return 500;
    }
};

const mapErrorMessage = (code: string): string => {
    switch (code) {
        case "UNAUTHORIZED": return "Bạn chưa đăng nhập hoặc phiên đã hết hạn.";
        case "FORBIDDEN": return "Chỉ có hội viên mới có quyền thực hiện hành động này.";
        case "METRIC_NOT_FOUND": return "Không tìm thấy dữ liệu chỉ số cơ thể.";
        case "MISSING_REQUIRED_FIELDS": return "Vui lòng nhập cân nặng và chiều cao.";
        default: return "Đã xảy ra lỗi hệ thống.";
    }
};

// 1. Lấy lịch sử chỉ số (Hội viên xem của mình, PT/Admin xem qua query ?userId=xxx)
export const getMemberHistory = async (req: AuthRequest, res: Response) => {
    try {
        const actorId = req.user?.userId;
        const role = req.user?.role;
        if (!actorId || !role) throw new Error("UNAUTHORIZED");

        let targetUserId: number;

        if (role === 'USER') {
            // Nếu đăng nhập bằng quyền Hội viên (USER), tự động lấy ID của chính họ
            targetUserId = actorId;
        } else {
            // Nếu đăng nhập bằng Admin/PT/Staff, lấy từ query string (?userId=xxx)
            const queryUserId = req.query.userId;
            if (!queryUserId) {
                return res.status(400).json({ 
                    success: false, 
                    message: "Vui lòng cung cấp ID của hội viên cần xem lịch sử qua query parameter (?userId=xxx)." 
                });
            }
            targetUserId = parseInt(queryUserId as string, 10);
            if (isNaN(targetUserId)) {
                return res.status(400).json({ success: false, message: "ID người dùng không hợp lệ." });
            }
        }

        const result = await bodyMetricsService.getMemberHistory(targetUserId, req.query as ListBodyMetricQueryDto);
        res.status(200).json({
            success: true,
            message: "Lấy lịch sử thành công.",
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ success: false, message: mapErrorMessage(code), error: code });
    }
};

// 2. Thêm chỉ số cơ thể mới (Chỉ dành riêng cho Hội viên tự nhập)
export const createMetric = async (req: AuthRequest, res: Response) => {
    try {
        const actorId = req.user?.userId;
        const role = req.user?.role;
        if (!actorId || !role) throw new Error("UNAUTHORIZED");

        // Chặn nếu không phải là Hội viên (USER)
        if (role !== 'USER') {
            throw new Error("FORBIDDEN");
        }

        const dto = req.body as CreateBodyMetricsDto;

        // Tự động gán user_id và recorded_by_id bằng ID của chính hội viên đang đăng nhập
        const result = await bodyMetricsService.addMetric(actorId, actorId, dto);
        res.status(201).json({
            success: true,
            message: "Thêm chỉ số thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ success: false, message: mapErrorMessage(code), error: code });
    }
};

// 3. Cập nhật chỉ số cơ thể (Chỉ dành riêng cho Hội viên sở hữu bản ghi)
export const updateMetric = async (req: AuthRequest, res: Response) => {
    try {
        const actorId = req.user?.userId;
        const role = req.user?.role;
        if (!actorId || !role) throw new Error("UNAUTHORIZED");

        // Chặn nếu không phải là Hội viên (USER)
        if (role !== 'USER') {
            throw new Error("FORBIDDEN");
        }

        const metricId = parseInt(req.params.id as string, 10);
        if (isNaN(metricId)) {
            return res.status(400).json({ success: false, message: "ID không hợp lệ." });
        }

        const existed = await bodyMetricsService.getMetricById(metricId);
        if (!existed) throw new Error("METRIC_NOT_FOUND");

        // Đảm bảo hội viên chỉ được sửa chỉ số của chính mình
        if (existed.user_id !== actorId) {
            throw new Error("FORBIDDEN");
        }

        const result = await bodyMetricsService.updateMetric(metricId, req.body as UpdateBodyMetricsDto);
        res.status(200).json({
            success: true,
            message: "Cập nhật thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ success: false, message: mapErrorMessage(code), error: code });
    }
};

// 4. Xóa chỉ số cơ thể (Chỉ dành riêng cho Hội viên sở hữu bản ghi)
export const deleteMetric = async (req: AuthRequest, res: Response) => {
    try {
        const actorId = req.user?.userId;
        const role = req.user?.role;
        if (!actorId || !role) throw new Error("UNAUTHORIZED");

        // Chặn nếu không phải là Hội viên (USER)
        if (role !== 'USER') {
            throw new Error("FORBIDDEN");
        }

        const metricId = parseInt(req.params.id as string, 10);
        if (isNaN(metricId)) {
            return res.status(400).json({ success: false, message: "ID không hợp lệ." });
        }

        const existed = await bodyMetricsService.getMetricById(metricId);
        if (!existed) throw new Error("METRIC_NOT_FOUND");

        // Đảm bảo hội viên chỉ được xóa chỉ số của chính mình
        if (existed.user_id !== actorId) {
            throw new Error("FORBIDDEN");
        }

        await bodyMetricsService.deleteMetric(metricId);
        res.status(200).json({
            success: true,
            message: "Xóa thành công."
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ success: false, message: mapErrorMessage(code), error: code });
    }
};