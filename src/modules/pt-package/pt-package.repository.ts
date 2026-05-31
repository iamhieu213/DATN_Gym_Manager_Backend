import { getMyAvailability } from './../coach/coach.controller';
import { ListPlanQueryDto } from './../plans/plans.dto';
import { PrismaClient } from "@prisma/client"
import { CreatePtPackageDto, UpdatePtPackageDto, SetCoachPackagePriceDto, ListPackageCoachQueryDto } from "./pt-package.dto"

export class PtPackageRepository {
    constructor(private readonly prisma: PrismaClient) { }

    //Lay danh sach goi tap
    public async findMany(where: any) {
        return this.prisma.ptPackage.findMany({
            where,
            orderBy: { numberOfSessions: 'asc' }
        })
    }

    //Tim kiem goi tap theo id
    public findById(id: number) {
        return this.prisma.ptPackage.findUnique({ where: { id } });
    }

    public async findByCode(code: string) {
        return this.prisma.ptPackage.findUnique({ where: { code } });
    }

    //Admin tao goi tap moi
    public async create(dto: CreatePtPackageDto) {
        return this.prisma.ptPackage.create({
            data: {
                name: dto.name,
                code : dto.code,
                numberOfSessions: dto.numberOfSessions,
                durationDays: dto.durationDays,
                goal: dto.goal,
                isActive: dto.isActive ?? true
            },
        });
    }

    //Cap nhat goi tap
    public async update(id: number, dto: UpdatePtPackageDto) {
        return this.prisma.ptPackage.update({
            where: { id },
            data: {
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.numberOfSessions !== undefined && { numberOfSessions: dto.numberOfSessions }),
                ...(dto.durationDays !== undefined && { durationDays: dto.durationDays }),
                ...(dto.goal !== undefined && { goal: dto.goal }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive })
            }
        });
    }

    //Admin gan gia cua PT cho goi tap
    public async upsertPrice(dto: SetCoachPackagePriceDto) {
        return this.prisma.coachPtPackage.upsert({
            where: {
                coachId_ptPackageId: {
                    coachId: dto.coachId,
                    ptPackageId: dto.ptPackageId
                }
            },
            update: {
                price: dto.price,
                isActive: true
            },
            create: {
                coachId: dto.coachId,
                ptPackageId: dto.ptPackageId,
                price: dto.price,
                isActive: true
            }
        });
    }


    //Loc danh sach PT day goi va khop lich ranh
    public async findPackageCoachesAndPrices(ptPackageId: number, query: ListPackageCoachQueryDto) {
        const where: any = { ptPackageId, isActive: true, coach: { isAvailable: true } };

        //Phan tich bo loc lich ranh neu co truyen len query
        if (query.slots) {
            try {
                const slots = typeof query.slots === 'string' ? JSON.parse(query.slots) : query.slots;
                if (Array.isArray(slots) && slots.length > 0) {
                    where.coach.AND = slots.map((slot: any) => {
                        const day = parseInt(slot.dayOfWeek, 10);
                        const [startH = 0, startM = 0] = slot.startTime.split(':').map(Number);
                        const [endH = 0, endM = 0] = slot.endTime.split(':').map(Number);
                        const startMins = startH * 60 + startM;
                        const endMins = endH * 60 + endM;
                        return {
                            availabilities: {
                                some: {
                                    dayOfWeek: day,
                                    startMinutes: { lte: startMins },
                                    endMinutes: { gte: endMins }
                                }
                            }
                        };
                    });
                }
            } catch (error) {
                console.error("Lỗi parse dữ liệu lọc khung giờ:", error);
            }
        } else if (query.dayOfWeek !== undefined && query.startTime && query.endTime) {
            const day = parseInt(query.dayOfWeek, 10);
            const [startH = 0, startM = 0] = query.startTime.split(':').map(Number);
            const [endH = 0, endM = 0] = query.endTime.split(':').map(Number);
            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            where.coach.availabilities = {
                some: {
                    dayOfWeek: day,
                    startMinutes: { lte: startMins },
                    endMinutes: { gte: endMins }
                }
            }
        }

        return this.prisma.coachPtPackage.findMany({
            where,
            include: {
                coach: {
                    include: {
                        user: {
                            select: { name: true, avatarUrl: true, email: true, phone: true }
                        },
                        availabilities: true
                    }
                }
            }
        });
    }
}