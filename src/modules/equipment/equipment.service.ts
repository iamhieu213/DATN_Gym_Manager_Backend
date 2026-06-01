import { EquipmentRepository } from "./equipment.repository";
import { CreateEquipmentDto, UpdateEquipmentDto, BulkUpdateEquipmentDto, BulkDeleteEquipmentDto, ListQueryEquipmentDetailDto } from "./equipment.dto";
import { EquipmentStatus } from '@prisma/client'

export class EquipmentService {
    constructor(private readonly repository : EquipmentRepository) {}

    //1.Them moi thiet bi hang loat + sinh ma tu dong
    public async createEquipment(role: string, dto: CreateEquipmentDto) {
        if (role !== 'ADMIN') {
            throw new Error('FORBIDDEN');
        }
        const { name, baseCode, quantity, purchaseDate, note } = dto;
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
                note: note || null
            });
        }
        await this.repository.createMany(newEquipments);
        return newEquipments.length;
    }

     public async getEquipmentSummary(query: { search?: string }) {
        const where: any = {};
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
    public async getEquipmentGroupDetails(role : string, name : string, query : ListQueryEquipmentDetailDto) {
        if(!name)throw new Error('BAD_REQUEST');

        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const where : any = {};

        if(query.status){
            where.status = query.status as EquipmentStatus;
        }

        if(query.search) {
            where.code = {
                contains: query.search,
                mode: 'insensitive'
            };
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
    public async updateEquipment(role : string, id : number, dto: UpdateEquipmentDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }

        const existing = await this.repository.findById(id);
        if(!existing) {
            throw new Error('EQUIPMENT_NOT_FOUND');
        }

        const updateData : any = {};
        if(dto.status) updateData.status = dto.status;
        if(dto.note !== undefined) updateData.note = dto.note;
        if (dto.lastMaintenanceDate) {
            updateData.lastMaintenanceDate = new Date(dto.lastMaintenanceDate);
        }

        return this.repository.update(id, updateData);
    }

    //Cap nhat hang loat thiet bi
    public async bulkUpdateEquipment(role : string, dto: BulkUpdateEquipmentDto) {
        if(role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }   

        if (!dto.ids || dto.ids.length === 0) {
            throw new Error('BAD_REQUEST');
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
    public async deleteEquipment(role: string, id: number) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error('FORBIDDEN');
        }
        const equipment = await this.repository.findById(id);
        if (!equipment) {
            throw new Error('EQUIPMENT_NOT_FOUND');
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
}