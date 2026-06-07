import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
    createEquipment,
    getEquipmentSummary,
    getEquipmentGroupDetails,
    updateEquipment,
    bulkUpdateEquipment,
    deleteEquipment,
    bulkDeleteEquipment,
    getEquipmentStats,
    getMaintenanceTasks,
    createMaintenanceTask,
    updateMaintenanceTask,
} from './equipment.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', createEquipment);            // Tạo hàng loạt máy mới
router.get('/summary', getEquipmentSummary);  // Xem danh sách gom nhóm (ADMIN, STAFF, COACH, USER)
router.get('/details', getEquipmentGroupDetails); // Xem chi tiết các máy trong 1 nhóm (ADMIN, STAFF, COACH, USER)
router.put('/bulk-update', bulkUpdateEquipment);  // Cập nhật trạng thái hàng loạt (tích checkbox)
router.post('/bulk-delete', bulkDeleteEquipment); // Xóa hàng loạt máy (tích checkbox)
router.get('/stats', getEquipmentStats);        // Hien thi so luong may 

router.get('/maintenance/tasks', getMaintenanceTasks);   // Lấy danh sách lịch bảo trì
router.post('/maintenance/tasks', createMaintenanceTask); // Tạo lịch bảo trì (hàng loạt)
router.put('/maintenance/tasks/:id', updateMaintenanceTask); // Cập nhật trạng thái/chi tiết bảo trì

router.put('/:id', updateEquipment);          // Cập nhật thông tin/trạng thái 1 máy cụ thể
router.delete('/:id', deleteEquipment);       // Xóa 1 máy cụ thể

export default router;