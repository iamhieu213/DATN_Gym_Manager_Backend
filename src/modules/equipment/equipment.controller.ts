import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { EquipmentRepository } from './equipment.repository';
import { EquipmentService } from './equipment.service';
import { prisma } from '../../config/client';
import { 
    CreateEquipmentDto, 
    UpdateEquipmentDto, 
    BulkUpdateEquipmentDto, 
    ListQueryEquipmentDetailDto // Sử dụng interface DTO của bạn
} from './equipment.dto';
const repository = new EquipmentRepository(prisma);
const service = new EquipmentService(repository);
const mapError = (msg: string) => {
    switch (msg) {
        case 'EQUIPMENT_NOT_FOUND': return { status: 404, message: 'Không tìm thấy thiết bị.' };
        case 'MAINTENANCE_TASK_NOT_FOUND': return { status: 404, message: 'Không tìm thấy lịch bảo trì.' };
        case 'FORBIDDEN': return { status: 403, message: 'Bạn không có quyền thực hiện hành động này.' };
        case 'INVALID_QUANTITY': return { status: 400, message: 'Số lượng thiết bị phải lớn hơn 0.' };
        case 'BAD_REQUEST': return { status: 400, message: 'Yêu cầu không hợp lệ.' };
        default: return { status: 500, message: 'Lỗi máy chủ. Vui lòng thử lại sau.' };
    }
};
// 1. API: Đăng ký thiết bị hàng loạt (Bulk Create)
export const createEquipment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const dto = req.body as CreateEquipmentDto;
        const count = await service.createEquipment(role, dto);
        
        res.status(201).json({ 
            success: true, 
            message: `Đã thêm mới ${count} thiết bị thành công.` 
        });
    } catch (e: any) {
        console.error('Error in createEquipment:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};
export const getEquipmentSummary = async (req: AuthRequest, res: Response) => {
    try {
        const search = req.query.search as string;
        const data = await service.getEquipmentSummary({ search });
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        console.error('Error in getEquipmentSummary:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 3. API: Lấy danh sách chi tiết máy của một nhóm (Hỗ trợ phân trang bằng ListQueryEquipmentDetailDto)
export const getEquipmentGroupDetails = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const name = req.query.name as string;
        
        // Nhận các query parameters và ép kiểu sang interface DTO của bạn
        const query = req.query as unknown as ListQueryEquipmentDetailDto;
        // ĐÃ SỬA: Truyền đủ 3 tham số (role, name, query) theo đúng thứ tự thiết lập ở Service
        const result = await service.getEquipmentGroupDetails(role, name, query);
        res.status(200).json({ 
            success: true, 
            data: result.data,
            meta: result.meta 
        });
    } catch (e: any) {
        console.error('Error in getEquipmentGroupDetails:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

export const updateEquipment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) throw new Error('BAD_REQUEST');
        const data = await service.updateEquipment(role, id, req.body);
        res.status(200).json({ success: true, message: 'Cập nhật thiết bị thành công.', data });
    } catch (e: any) {
        console.error('Error in updateEquipment:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};
export const bulkUpdateEquipment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const count = await service.bulkUpdateEquipment(role, req.body);
        res.status(200).json({ success: true, message: `Đã cập nhật ${count} thiết bị thành công.` });
    } catch (e: any) {
        console.error('Error in bulkUpdateEquipment:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};
export const deleteEquipment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) throw new Error('BAD_REQUEST');
        await service.deleteEquipment(role, id);
        res.status(200).json({ success: true, message: 'Xóa thiết bị thành công.' });
    } catch (e: any) {
        console.error('Error in deleteEquipment:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};
export const bulkDeleteEquipment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const { ids } = req.body;
        const count = await service.bulkDeleteEquipment(role, ids);
        res.status(200).json({ success: true, message: `Đã xóa ${count} thiết bị thành công.` });
    } catch (e: any) {
        console.error('Error in bulkDeleteEquipment:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 8. Lấy tổng số lượng thiết bị theo trạng thái
export const getEquipmentStats = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        
        const data = await service.getEquipmentStats(role);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        console.error('Error in getEquipmentStats:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 9. Lấy danh sách nhiệm vụ bảo trì sắp tới
export const getMaintenanceTasks = async (req: AuthRequest, res: Response) => {
    try {
        const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
        const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
        
        const data = await service.getMaintenanceTasks(month, year);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        console.error('Error in getMaintenanceTasks:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 10. Lên lịch bảo trì mới (hỗ trợ hàng loạt)
export const createMaintenanceTask = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        
        const data = await service.createMaintenanceTask(role, req.body);
        res.status(201).json({ success: true, message: 'Đã lên lịch bảo trì thiết bị.', data });
    } catch (e: any) {
        console.error('Error in createMaintenanceTask:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// 11. Cập nhật lịch bảo trì
export const updateMaintenanceTask = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error('FORBIDDEN');
        const id = parseInt(req.params.id as string, 10);
        if (isNaN(id)) throw new Error('BAD_REQUEST');
        
        const data = await service.updateMaintenanceTask(role, id, req.body);
        res.status(200).json({ success: true, message: 'Cập nhật lịch bảo trì thành công.', data });
    } catch (e: any) {
        console.error('Error in updateMaintenanceTask:', e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

