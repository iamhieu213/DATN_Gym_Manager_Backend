import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { BranchService } from "./branch.service";
import { BranchRepository } from "./branch.repository";
import { prisma } from "../../config/client";
import { CreateBranchDto, UpdateBranchDto, ListBranchQueryDto } from "./branch.dto";

const repository = new BranchRepository(prisma);
const service = new BranchService(repository);

// Định nghĩa mã lỗi HTTP phù hợp
const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "BRANCH_NOT_FOUND":
            return 404;
        case "MISSING_REQUIRED_FIELDS":
        case "BRANCH_CODE_ALREADY_EXISTS": 
        case "BAD_REQUEST":
            return 400;
        default:
            return 500;
    }
};

// Định nghĩa câu dịch thông báo lỗi thân thiện bằng Tiếng Việt
const mapErrorMessage = (code: string): string => {
    switch (code) {
        case "UNAUTHORIZED":
            return "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.";
        case "FORBIDDEN":
            return "Bạn không có quyền thực hiện chức năng này.";
        case "BRANCH_NOT_FOUND":
            return "Không tìm thấy thông tin chi nhánh này.";
        case "MISSING_REQUIRED_FIELDS":
            return "Vui lòng nhập đầy đủ các trường thông tin bắt buộc (Tên, Mã, Địa chỉ).";
        case "BRANCH_CODE_ALREADY_EXISTS": 
            return "Mã chi nhánh này đã tồn tại trên hệ thống. Vui lòng chọn mã khác.";
        default:
            return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    }
};

//1. Lay danh sach chi nhanh
export const getAllBranches = async(req : AuthRequest, res: Response) => {
    try{
        const result = await service.getAllBranches(req.query as ListBranchQueryDto);
        res.status(200).json({
            success : true,
            message : "Lấy danh sách chi nhánh thành công.",
            data: result.data,
            meta: result.meta
        })
    }catch(error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success : false,
            message : mapErrorMessage(code),
            error : code
        })
    }
};


// 2. Lấy thông tin chi nhánh theo ID
export const getBranchById = async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) throw new Error("BAD_REQUEST");
        const branch = await service.getBranchById(id);
        res.status(200).json({
            success: true,
            message: "Lấy thông tin chi nhánh thành công.",
            data: branch
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
// 3. Tạo chi nhánh mới
export const createBranch = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role ?? "";
        const branch = await service.createBranch(role, req.body as CreateBranchDto);
        res.status(201).json({
            success: true,
            message: "Tạo chi nhánh mới thành công.",
            data: branch
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
// 4. Cập nhật thông tin chi nhánh
export const updateBranch = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role ?? "";
        const id = Number(req.params.id);
        if (isNaN(id)) throw new Error("BAD_REQUEST");
        const branch = await service.updateBranch(role, id, req.body as UpdateBranchDto);
        res.status(200).json({
            success: true,
            message: "Cập nhật thông tin chi nhánh thành công.",
            data: branch
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

//5.Kich hoat hoat dong phong tap
export const activeBranch = async(req: AuthRequest, res : Response) => {
    try {
        const role = req.user?.role ?? "";
        const id = Number(req.params.id);
        if (isNaN(id)) throw new Error("BAD_REQUEST");

        const branch = await service.activateBranch(role, id);
        res.status(200).json({
            success: true,
            message: "Kích hoạt chi nhánh thành công.",
            data: branch
        })
    }catch(error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

//6.Khoa phong tap
export const deactiveBranch = async(req: AuthRequest, res : Response) => {
    try {
        const role = req.user?.role ?? "";
        const id = Number(req.params.id);
        if (isNaN(id)) throw new Error("BAD_REQUEST");

        const branch = await service.deactivateBranch(role, id);
        res.status(200).json({
            success: true,
            message: "Tạm ngưng hoạt động chi nhánh thành công.",
            data: branch
        })
    }catch(error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}