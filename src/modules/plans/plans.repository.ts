import { PrismaClient } from '@prisma/client';
import { CreatePlanDto, UpdatePlanDto } from './plans.dto';

export class PlansRepository {
    constructor(private readonly prisma: PrismaClient) { }

    public async findMany(where: any, skip: number, take: number) {
        return this.prisma.plan.findMany({
            where,
            skip,
            take,
            orderBy: { created_at: 'desc' }
        });
    }

    //Dem tong so goi tap theo dieu kien
    public async count(where: any) {
        return this.prisma.plan.count({ where });
    }

    //Tim goi tap theo id
    public async findById(id: number) {
        return this.prisma.plan.findUnique({ where: { id } });
    }

    //Tao goi tap moi
    public async create(dto: CreatePlanDto) {
        return this.prisma.plan.create({
            data: {
                name: dto.name,
                description: dto.description ?? null,
                price: dto.price,
                duration_days: dto.duration_days,
                features: dto.features ?? [],
                is_active: dto.is_active ?? true
            }
        });
    }

    //Cap nhat goi tap
    public async update(id: number, dto: UpdatePlanDto) {
        return this.prisma.plan.update({
            where: { id },

            data: {
                ...(dto.name !== undefined && {
                    name: dto.name,
                }),

                ...(dto.description !== undefined && {
                    description: dto.description ?? null,
                }),

                ...(dto.price !== undefined && {
                    price: dto.price,
                }),

                ...(dto.duration_days !== undefined && {
                    duration_days: dto.duration_days,
                }),

                ...(dto.features !== undefined && {
                    features: dto.features,
                }),

                ...(dto.is_active !== undefined && {
                    is_active: dto.is_active,
                }),
            }
        });
    }

    //Khoa/Mo goi tap
    public async isActivate(id: number, is_active: boolean) {
        return this.prisma.plan.update({
            where: { id },
            data: { is_active }
        });
    }

}

