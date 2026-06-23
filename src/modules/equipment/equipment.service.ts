import { EquipmentRepository } from "./equipment.repository";
import { CreateEquipmentDto, UpdateEquipmentDto, BulkUpdateEquipmentDto, BulkDeleteEquipmentDto, ListQueryEquipmentDetailDto, CreateMaintenanceTaskDto, UpdateMaintenanceTaskDto } from "./equipment.dto";
import { EquipmentStatus } from '@prisma/client'

export class EquipmentService {
    constructor(private readonly repository: EquipmentRepository) { }

    //1.Them moi thiet bi hang loat + sinh ma tu dong
    public async createEquipment(role: string, dto: CreateEquipmentDto) {
        if (role !== 'ADMIN') {
            throw new Error('FORBIDDEN');
        }
        const { name, baseCode, quantity, purchaseDate, note, branchId } = dto;
        if (!branchId) throw new Error('BAD_REQUEST');
        if (quantity <= 0) {
            throw new Error('INVALID_QUANTITY');
        }
        // Tìm số thứ tự máy lớn nhất đã tồn tại trong hệ thống
        const existingItems = await this.repository.findExistingCodes(baseCode);
        let maxSuffix = 0;
        for (const item of existingItems) {
            const parts = item.code.split('-');
            const lastPart = parts[parts.length - 1]!;
            const num = parseInt(lastPart, 10);
            if (!isNaN(num) && num > maxSuffix) {
                maxSuffix = num;
            }
        }
        // Sinh danh sách bản ghi mới
        const newEquipments = [];
        for (let i = 1; i <= quantity; i++) {
            const nextSuffix = maxSuffix + i;
            const formattedSuffix = nextSuffix.toString().padStart(2, '0'); // Định dạng 01, 02, 10...
            const generatedCode = `${baseCode}-${formattedSuffix}`;
            newEquipments.push({
                name,
                code: generatedCode,
                status: 'OPERATIONAL' as EquipmentStatus,
                purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
                note: note || null,
                branchId: branchId
            });
        }
        await this.repository.createMany(newEquipments);
        return newEquipments.length;
    }

    public async getEquipmentSummary(role: string, actorBranchId: number | null | undefined, query: { search?: string, branchId?: string }) {
        const where: any = {};

        let targetBranchId: number | null = null;
        if (role === 'ADMIN') {
            targetBranchId = query.branchId ? Number(query.branchId) : null;
        } else {
            targetBranchId = query.branchId ? Number(query.branchId) : (actorBranchId ?? null);
        }
        if (targetBranchId) {
            where.branchId = targetBranchId;
        }
        if (query.search) {
            where.name = {
                contains: query.search,
                mode: 'insensitive'
            };
        }
        const allItems = await this.repository.findAll(where);
        // Gom nhóm tính số lượng
        const summaryMap: Record<string, any> = {};
        for (const item of allItems) {
            if (!summaryMap[item.name]) {
                summaryMap[item.name] = {
                    name: item.name,
                    totalCount: 0,
                    operationalCount: 0,
                    brokenCount: 0
                };
            }
            summaryMap[item.name].totalCount += 1;
            if (item.status === 'OPERATIONAL') {
                summaryMap[item.name].operationalCount += 1;
            } else {
                summaryMap[item.name].brokenCount += 1;
            }
        }
        return Object.values(summaryMap);
    }

    //Lay chi tiet cac may (khong cho USER xem thong tin nhay cam)
    public async getEquipmentGroupDetails(role: string, actorBranchId: number | null | undefined, name: string | undefined, query: ListQueryEquipmentDetailDto) {
        // name là optional để hỗ trợ hiển thị toàn bộ thiết bị sảnh gym

        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const where: any = {};

        if (query.status) {
            where.status = query.status as EquipmentStatus;
        }

        if (query.search) {
            where.code = {
                contains: query.search,
                mode: 'insensitive'
            };
        }

        let targetBranchId: number | null = null;
        if (role === 'ADMIN') {
            targetBranchId = query.branchId ? Number(query.branchId) : null;
        } else {
            targetBranchId = query.branchId ? Number(query.branchId) : (actorBranchId ?? null);
        }

        if (targetBranchId) {
            where.branchId = targetBranchId;
        }

        //Truy van song song danh sach phan trang va dem tong so luong
        const [items, total] = await Promise.all([
            this.repository.findByName(name, where, skip, limit),
            this.repository.countByName(name, where)
        ]);

        const processedItems = role === 'USER' || role === 'COACH'
            ? items.map(item => ({ id: item.id, name: item.name, code: item.code, status: item.status })) : items;

        return {
            data: processedItems,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        }
    }

    //Cap nhat 1 thiet bi
    public async updateEquipment(role: string, id: number, actorBranchId: number | null | undefined, dto: UpdateEquipmentDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }

        const existing = await this.repository.findById(id);
        if (!existing) {
            throw new Error('EQUIPMENT_NOT_FOUND');
        }

        //Chan staff sua thiet bi chi nhanh khac
        if (role === 'STAFF' && existing.branchId !== actorBranchId) {
            throw new Error('FORBIDDEN');
        }

        const updateData: any = {};
        if (dto.status) updateData.status = dto.status;
        if (dto.note !== undefined) updateData.note = dto.note;
        if (dto.lastMaintenanceDate) {
            updateData.lastMaintenanceDate = new Date(dto.lastMaintenanceDate);
        }

        return this.repository.update(id, updateData);
    }

    //Cap nhat hang loat thiet bi
    public async bulkUpdateEquipment(role: string, actorBranchId: number | null | undefined, dto: BulkUpdateEquipmentDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }

        if (!dto.ids || dto.ids.length === 0) {
            throw new Error('BAD_REQUEST');
        }

        if (role === 'STAFF') {
            const equipments = await this.repository.findAll({ id: { in: dto.ids } });
            const hasInvalid = equipments.some(eq => eq.branchId !== actorBranchId);
            if (hasInvalid) throw new Error('FORBIDDEN');
        }

        const updateData: any = {};
        if (dto.status) updateData.status = dto.status;
        if (dto.note !== undefined) updateData.note = dto.note;
        if (dto.lastMaintenanceDate) {
            updateData.lastMaintenanceDate = new Date(dto.lastMaintenanceDate);
        }
        const result = await this.repository.updateMany(dto.ids, updateData);
        return result.count;
    }

    // 6. Xóa 1 thiết bị cụ thể (ADMIN, STAFF)
    public async deleteEquipment(role: string, actorBranchId: number | null | undefined, id: number) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }
        const equipment = await this.repository.findById(id);
        if (!equipment) {
            throw new Error('EQUIPMENT_NOT_FOUND');
        }
        // Chặn STAFF xóa thiết bị chi nhánh khác
        if (role === 'STAFF' && equipment.branchId !== actorBranchId) {
            throw new Error('FORBIDDEN');
        }
        await this.repository.delete(id);
    }

    // 7. Xóa hàng loạt thiết bị (ADMIN, STAFF)
    public async bulkDeleteEquipment(role: string, ids: number[]) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }
        if (!ids || ids.length === 0) {
            throw new Error('BAD_REQUEST');
        }
        const result = await this.repository.deleteMany(ids);
        return result.count;
    }

    // 8. Lấy tổng số lượng thiết bị theo trạng thái
    public async getEquipmentStats(role: string, actorBranchId: number | null | undefined, queryBranchId?: string) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }

        let targetBranchId: number | undefined = undefined;
        if (role === 'STAFF') {
            if (!actorBranchId) throw new Error('STAFF_BRANCH_REQUIRED');
            targetBranchId = actorBranchId;
        } else if (role === 'ADMIN' && queryBranchId) {
            targetBranchId = Number(queryBranchId);
        }
        const rawStats = await this.repository.getStatsSummary();

        const stats = {
            total: 0,
            operational: 0,
            underMaintenance: 0,
            outOfService: 0
        };

        rawStats.forEach(item => {
            const count = item._count.id;
            stats.total += count; // Cộng dồn vào tổng số máy

            if (item.status === 'OPERATIONAL') {
                stats.operational = count;
            } else if (item.status === 'UNDER_MAINTENANCE') {
                stats.underMaintenance = count;
            } else if (item.status === 'OUT_OF_SERVICE') {
                stats.outOfService = count;
            }
        });

        return stats;
    }

    // Thêm vào trong class EquipmentService:

    // 1. Lấy danh sách nhiệm vụ bảo trì sắp tới
    public async getMaintenanceTasks(role: string,
        actorBranchId: number | null | undefined,
        month?: number, year?: number,
        queryBranchId?: string) {
        const where: any = {};

        let targetBranchId: number | null = null;
        if (role === 'STAFF') {
            targetBranchId = actorBranchId ?? null;
        } else if (role === 'ADMIN' && queryBranchId) {
            targetBranchId = Number(queryBranchId);
        }

        if (targetBranchId) {
            where.equipment = { branchId: targetBranchId };
        }

        // Nếu có lọc theo tháng/năm
        if (month && year) {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
            where.scheduledAt = {
                gte: startOfMonth,
                lte: endOfMonth
            };
        } else {
            // Mặc định lấy các lịch chưa hoàn thành (PENDING, IN_PROGRESS)
            where.status = { in: ['PENDING', 'IN_PROGRESS'] };
        }

        return this.repository.findMaintenanceTasks(where);
    }

    // 2. Lên lịch bảo trì mới (hỗ trợ hàng loạt) & Tự động đổi trạng thái máy sang UNDER_MAINTENANCE
    public async createMaintenanceTask(role: string, dto: CreateMaintenanceTaskDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }

        const { equipmentIds, title, description, scheduledAt, priority, assignedTeam } = dto;
        if (!equipmentIds || equipmentIds.length === 0) {
            throw new Error('BAD_REQUEST');
        }

        // Tạo lịch bảo trì cho toàn bộ danh sách máy song song
        const tasks = await Promise.all(
            equipmentIds.map(id =>
                this.repository.createMaintenanceTask({
                    equipmentId: id,
                    title,
                    description: description || null,
                    scheduledAt: new Date(scheduledAt),
                    priority,
                    assignedTeam: assignedTeam || null
                })
            )
        );

        // Tự động chuyển trạng thái của tất cả các máy này sang ĐANG BẢO TRÌ
        await this.repository.updateMany(equipmentIds, { status: 'UNDER_MAINTENANCE' });

        return tasks;
    }

    // 3. Hoàn thành bảo trì & Tự động chuyển máy về OPERATIONAL
    public async updateMaintenanceTask(role: string, id: number, dto: UpdateMaintenanceTaskDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }

        const task = await this.repository.findMaintenanceTaskById(id);
        if (!task) throw new Error('MAINTENANCE_TASK_NOT_FOUND');

        const updateData: any = {};
        if (dto.status) updateData.status = dto.status;
        if (dto.cost !== undefined) updateData.cost = dto.cost;
        if (dto.notes !== undefined) updateData.notes = dto.notes;

        if (dto.status === 'COMPLETED') {
            updateData.completedAt = new Date();
        }

        const updatedTask = await this.repository.updateMaintenanceTask(id, updateData);

        // Nếu sửa xong (COMPLETED), chuyển máy về Hoạt động tốt & cập nhật ngày sửa cuối
        if (dto.status === 'COMPLETED') {
            await this.repository.update(task.equipmentId, {
                status: 'OPERATIONAL',
                lastMaintenanceDate: new Date()
            });
        }

        return updatedTask;
    }
}