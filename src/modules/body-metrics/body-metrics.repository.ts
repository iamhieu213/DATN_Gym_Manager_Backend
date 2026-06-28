import { PrismaClient } from '@prisma/client'
import { CreateBodyMetricsDto, UpdateBodyMetricsDto } from './body-metrics.dto'

export class BodyMetricsRepository {
    constructor(private readonly prisma: PrismaClient) {}

    public async findMany(where: any, skip: number, take: number) {
        return this.prisma.bodyMetric.findMany({
            where,
            skip,
            take,
            orderBy: { recorded_at: 'desc' },
            include: {
                recordedBy: {
                    select: { id: true, name: true, role: true },
                }
            }
        });
    }

    public async count(where: any) {
        return this.prisma.bodyMetric.count({ where });
    }

    public async findById(id: number) {
        return this.prisma.bodyMetric.findUnique({
            where: { id },
            include: {
                recordedBy: {
                    select: { id: true, name: true, role: true }
                }
            }
        });
    }

    public async create(data: CreateBodyMetricsDto & { user_id: number; recorded_by_id: number; bmi: number }) {
        return this.prisma.bodyMetric.create({
            data: {
                user_id: data.user_id,
                weight_kg: data.weight_kg,
                height_cm: data.height_cm,
                bmi: data.bmi,
                body_fat_pct: data.body_fat_pct ?? null,
                muscle_mass_kg: data.muscle_mass_kg ?? null,
                water_pct: data.water_pct ?? null,
                note: data.note ?? null,
                recorded_at: data.recorded_at ? new Date(data.recorded_at) : new Date(),
                recorded_by_id: data.recorded_by_id
            }
        });
    }

    public async update(id: number, data: UpdateBodyMetricsDto & { bmi?: number }) {
        return this.prisma.bodyMetric.update({
            where: { id },
            data: {
                ...(data.weight_kg !== undefined && { weight_kg: data.weight_kg }),
                ...(data.height_cm !== undefined && { height_cm: data.height_cm }),
                ...(data.bmi !== undefined && { bmi: data.bmi }),
                ...(data.body_fat_pct !== undefined && { body_fat_pct: data.body_fat_pct }),
                ...(data.muscle_mass_kg !== undefined && { muscle_mass_kg: data.muscle_mass_kg }),
                ...(data.water_pct !== undefined && { water_pct: data.water_pct }),
                ...(data.note !== undefined && { note: data.note }),
                ...(data.recorded_at !== undefined && { recorded_at: new Date(data.recorded_at) }),
            }
        });
    }

    public async delete(id: number) {
        return this.prisma.bodyMetric.delete({
            where: { id }
        });
    }
}