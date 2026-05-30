import { PrismaClient } from '@prisma/client'
import { UpdateCoachProfileDto } from './coach.dto'

export class CoachRepository {
    constructor(private readonly prisma: PrismaClient) { }

    public async findMany(where: any, skip: number, take: number) {
        return this.prisma.coachProfile.findMany({
            where,
            skip,
            take,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        phone: true,
                        avatarUrl: true
                    }
                },
                availabilities: true
            }
        });
    }

    public async count(where: any) {
        return this.prisma.coachProfile.count({ where });
    }

    public async findById(id: number) {
        return this.prisma.coachProfile.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        phone: true,
                        avatarUrl: true,
                    }
                },
                availabilities: true
            }
        });
    }

    public async findByUserId(userId: number) {
        return this.prisma.coachProfile.findUnique({
            where: { userId },
        });
    }

    public async createProfile(userId: number) {
        return this.prisma.coachProfile.create({
            data: {
                userId,
                isAvailable: true,
            },
        });
    }

    public async updateProfile(id: number, dto: UpdateCoachProfileDto) {
        return this.prisma.coachProfile.update({
            where: { id },
            data: {
                ...(dto.speciality !== undefined && { speciality: dto.speciality }),
                ...(dto.bio !== undefined && { bio: dto.bio }),
                ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable })
            }
        });
    }

    public async updateAvailabilities(coachId: number, availabilities: any[]) {
        // Run in a transaction to replace availability templates
        return this.prisma.$transaction(async (tx) => {
            await tx.coachAvailability.deleteMany({
                where: { coachId }
            });
            return tx.coachAvailability.createMany({
                data: availabilities.map(av => ({
                    coachId,
                    dayOfWeek: av.dayOfWeek,
                    startTime: av.startTime,
                    endTime: av.endTime,
                    startMinutes: av.startMinutes,
                    endMinutes: av.endMinutes
                }))
            });
        });
    }

}