import { PrismaClient } from '@prisma/client';

export class EquipmentRepository {
    constructor(private readonly prisma: PrismaClient) { }

    //Tim tat ca cac thiet bi kem theo bo loc
    public async findAll(where: any = {}) {
        return this.prisma.equipment.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
    }

    //Tim chi tiet may co cung ten kem bo loc
    public async findByName(name?: string, where: any = {}, skip?: number, take?: number) {
        return this.prisma.equipment.findMany({
            where: {
                ...(name && { name }),
                ...where
            },
            ...(skip !== undefined && { skip }),
            ...(take !== undefined && { take }),
            orderBy: { code: 'asc' }
        });
    }

    //Dem tong so luong may cua nhom 
    public async countByName(name?: string, where: any = {}) {
        return this.prisma.equipment.count({
            where: {
                ...(name && { name }),
                ...where
            }
        });
    }

    //Tim 1 thiet bi bang Id
    public async findById(id: number) {
        return this.prisma.equipment.findUnique({
            where: { id },
        });
    }

    //Lay cac ma may cung baseCode phuc vu tang so thu tu
    public async findExistingCodes(baseCode: string) {
        return this.prisma.equipment.findMany({
            where: {
                code: {
                    startsWith: `${baseCode}`
                }
            },
            select: { code: true }
        })
    }

    //Tao hang loat may trong mot database
    public async createMany(data: any[]) {
        return this.prisma.equipment.createMany({
            data
        });
    }

    //Cap nhat 1 thiet bi
    public async update(id: number, data: any) {
        return this.prisma.equipment.update({
            where: { id },
            data
        });
    }

    //Cap nhat nhieu thiet bi cung 1 luc
    public async updateMany(ids: number[], data: any) {
        return this.prisma.equipment.updateMany({
            where: {
                id: { in: ids }
            },
            data
        });
    }

    //Xoa 1 thiet bi cu the
    public async delete(id: number) {
        return this.prisma.equipment.delete({
            where: { id }
        })
    }

    //Xoa hang loat cac thiet bi
    public async deleteMany(ids: number[]) {
        return this.prisma.equipment.deleteMany({
            where: {
                id: { in: ids }
            }
        })
    }

    // Thống kê số lượng thiết bị theo trạng thái
    public async getStatsSummary(branchId? : number) {
        return this.prisma.equipment.groupBy({
            by: ['status'],
            where : branchId ? { branchId } : {},
            _count: {
                id: true
            }
        });
    }

    //1.Lay danh sach lich bao tri kem thong tin thiet bi
    public async findMaintenanceTasks(where: any = {}) {
        return this.prisma.maintenanceTask.findMany({
            where,
            include: {
                equipment: {
                    select: { name: true, code: true }
                }
            },
            orderBy: { scheduledAt: 'asc' }
        })
    }

    //2.Tao lich bao tri moi
    public async createMaintenanceTask(data: any) {
        return this.prisma.maintenanceTask.create({
            data
        });
    }

    //3.Cap nhat lich bao tri
    public async updateMaintenanceTask(id: number, data: any) {
        return this.prisma.maintenanceTask.update({
            where: { id },
            data
        })
    }

    //Tim lich bao tri theo Id
    public async findMaintenanceTaskById(id: number) {
        return this.prisma.maintenanceTask.findUnique({
            where: { id }
        });
    }
}