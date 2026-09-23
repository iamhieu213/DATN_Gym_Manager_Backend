import { PrismaClient } from '@prisma/client'

export class WorkoutSessionRepository {
    constructor(private readonly prisma: PrismaClient) { }

    //Tim hop dong dang thue PT cua hoi vien
    async findActiveAssignment(userId: number, coachId: number) {
        return this.prisma.coachAssignment.findFirst({
            where: {
                userId,
                coachId,
                status: 'ACTIVE',
                endDate: {
                    gte: new Date()
                }
            }
        })
    }

    //Khau tru 1 buoi tap khau tru thanh cong 
    async deductSession(assignmentId: number, remainingSessions: number) {
        return this.prisma.coachAssignment.update({
            where: { id: assignmentId },
            data: { remainingSessions: remainingSessions - 1 }
        });
    }

    //Hoan lai 1 buoi tap neu bi huy
    async refundSession(assignmentId: number, remainingSessions: number) {
        return this.prisma.coachAssignment.update({
            where: { id : assignmentId },
            data : { remainingSessions: remainingSessions + 1 }
        })
    }

    //Tim cac buoi tap de len lich cua PT trong 1 ngay cu the de kiem tra trung
    async findCoachSessionInDay(coachId: number, startOfDate: Date, endOfDate: Date) {
        return this.prisma.workoutSession.findMany({
            where: {
                coachId,
                status: 'PLANNED',
                scheduleAt: {
                    gte: startOfDate,
                    lte: endOfDate
                }
            }
        })
    }

    //Tao buoi tap moi
    


}