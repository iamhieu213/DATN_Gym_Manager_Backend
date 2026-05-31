import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { PtPackageService } from './pt-package.service';
import { PtPackageRepository } from './pt-package.repository';
import { prisma } from '../../config/client';
import { ListPackageCoachQueryDto, ListPtPackageQueryDto } from './pt-package.dto';

const repository = new PtPackageRepository(prisma);
const service = new PtPackageService(repository);

const mapError = (msg: string) => {
    switch (msg) {
        case "PACKAGE_NOT_FOUND": return { status: 404, message: "Không tìm thấy gói tập PT mẫu yêu cầu." };
        case "PACKAGE_CODE_ALREADY_EXISTS": return { status: 400, message: "Mã gói PT này đã tồn tại trên hệ thống. Vui lòng chọn mã khác." };
        case "MISSING_REQUIRED_FIELDS": return { status: 400, message: "Vui lòng nhập đầy đủ các trường bắt buộc." };
        case "COACH_PACKAGE_RELATION_NOT_FOUND": return { status: 404, message: "PT này chưa được thiết lập giá cho gói tập tương ứng." };
        case "FORBIDDEN": return { status: 403, message: "Bạn không có quyền thực hiện chức năng quản trị này." };
        default: return { status: 500, message: "Lỗi hệ thống. Vui lòng thử lại sau." };
    }
};

// GET /pt-package (Xem tất cả gói)
export const getPackages = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const queryParams = req.query as unknown as ListPtPackageQueryDto;
        const data = await service.getAllPackages(role, queryParams);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// GET /pt-package/:id/coaches (Xem PT dạy gói đó kèm lọc lịch rảnh)
export const getPackageCoaches = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseInt(req.params.id as string, 10);

        // 1. Lấy thông tin role từ token đăng nhập
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");
        // Cast query từ Express sang kiểu ListPackageCoachQueryDto
        const queryParams = req.query as unknown as ListPackageCoachQueryDto;
        // 2. Truyền thêm tham số role vào Service
        const data = await service.getCoachesForPackage(id, queryParams, role);

        res.status(200).json({ success: true, data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// POST /pt-package (Admin tạo gói)
export const createPackage = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const data = await service.createPackage(role, req.body);
        res.status(201).json({ success: true, message: "Tạo gói PT mẫu thành công.", data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// PUT /pt-package/:id (Admin cập nhật gói tập)
export const updatePackage = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");
        const id = parseInt(req.params.id as string, 10);

        const data = await service.updatePackage(role, id, req.body);
        res.status(200).json({ success: true, message: "Cập nhật gói PT mẫu thành công.", data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// POST /pt-package/set-price (Admin gán giá PT)
export const setCoachPrice = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");

        const data = await service.setCoachPrice(role, req.body);
        res.status(200).json({ success: true, message: "Cài đặt bảng giá PT thành công.", data });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 1. Mở hoạt động Gói PT mẫu
export const activatePackage = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        const id = parseInt(req.params.id as string, 10);
        await service.updatePackageStatus(role!, id, true);
        res.status(200).json({ success: true, message: "Mở hoạt động gói PT thành công." });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 2. Khóa hoạt động Gói PT mẫu
export const deactivatePackage = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        const id = parseInt(req.params.id as string, 10);
        await service.updatePackageStatus(role!, id, false);
        res.status(200).json({ success: true, message: "Khóa hoạt động gói PT thành công." });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 3. Cho phép PT nhận dạy Gói tập
export const activateCoachPackage = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        const ptPackageId = parseInt(req.params.id as string, 10);
        const coachId = parseInt(req.params.coachId as string, 10);
        await service.updateCoachPackageStatus(role!, coachId, ptPackageId, true);
        res.status(200).json({ success: true, message: "Kích hoạt quyền dạy gói tập cho PT thành công." });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 4. Dừng/Khóa quyền dạy Gói tập của PT
export const deactivateCoachPackage = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        const ptPackageId = parseInt(req.params.id as string, 10);
        const coachId = parseInt(req.params.coachId as string, 10);
        await service.updateCoachPackageStatus(role!, coachId, ptPackageId, false);
        res.status(200).json({ success: true, message: "Khóa quyền dạy gói tập của PT thành công." });
    } catch (e: any) {
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};