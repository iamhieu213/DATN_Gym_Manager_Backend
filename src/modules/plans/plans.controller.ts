import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { PlansService } from "./plans.service";
import { PlansRepository } from "./plans.repository";
import { prisma } from "../../config/client";
import { CreatePlanDto, UpdatePlanDto, ListPlanQueryDto } from "./plans.dto";

const plansRepository = new PlansRepository(prisma);
const planService = new PlansService(plansRepository);

const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "PLAN_NOT_FOUND":
            return 404;
        case "PLAN_IN_USE":
        case "MISSING_REQUIRED_FIELDS":
        case "PLAN_CODE_ALREADY_EXISTS": 
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
            return "Không tìm thấy thông tin gói tập này.";
        case "PLAN_IN_USE":
            return "Không thể xóa gói tập đang có hội viên đăng ký sử dụng. Vui lòng chuyển trạng thái thành ngừng hoạt động (is_active = false) thay vì xóa.";
        case "MISSING_REQUIRED_FIELDS":
            return "Vui lòng nhập đầy đủ các trường thông tin bắt buộc.";
        case "BAD_REQUEST":
            return "Yêu cầu dữ liệu gửi lên không hợp lệ.";
        case "PLAN_CODE_ALREADY_EXISTS": 
            return "Mã gói tập này đã tồn tại trên hệ thống. Vui lòng chọn mã khác."
        default:
            return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    }
};

// 1. Lấy danh sách gói tập (Hội viên chỉ xem gói active, Admin/Staff xem hết)
export const getAllPlans = async (req: AuthRequest, res: Response) => {
    try {
        const query = req.query as ListPlanQueryDto;
        
        // Nếu không phải ADMIN/STAFF -> Ép chỉ xem các gói tập đang mở bán
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF')) {
            query.is_active = 'true';
        }

        const result = await planService.getAllPlans(query);
        res.status(200).json({
            success: true,
            message: "Lấy danh sách gói tập thành công.",
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

// 2. Lấy chi tiết 1 gói tập
export const getPlanById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const result = await planService.getPlanById(id);
        res.status(200).json({
            success: true,
            message: "Lấy chi tiết gói tập thành công.",
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

// 3. Tạo gói tập mới
export const createPlan = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("UNAUTHORIZED");

        const result = await planService.createPlan(role, req.body as CreatePlanDto);
        res.status(201).json({
            success: true,
            message: "Tạo gói tập mới thành công.",
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

// 4. Cập nhật gói tập
export const updatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        if (!role) throw new Error("UNAUTHORIZED");

        const result = await planService.updatePlan(role, id, req.body as UpdatePlanDto);
        res.status(200).json({
            success: true,
            message: "Cập nhật thông tin gói tập thành công.",
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

// 5. Mở khóa gói tập (Activate) - Chỉ ADMIN/STAFF
export const activatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        if (!role) throw new Error("UNAUTHORIZED");

        const result = await planService.activate(id, role);
        res.status(200).json({
            success: true,
            message: "Mở khóa gói tập thành công.",
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

// 6. Khóa gói tập (Deactivate) - Chỉ ADMIN/STAFF
export const deactivatePlan = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói tập không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        if (!role) throw new Error("UNAUTHORIZED");

        const result = await planService.deactivate(id, role);
        res.status(200).json({
            success: true,
            message: "Khóa gói tập thành công.",
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

