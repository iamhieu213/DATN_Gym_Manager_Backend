import { PrismaClient } from "@prisma/client";

export class CheckInRepository {
    
    constructor( private readonly prisma : PrismaClient ) {}

    //Tim kiem user dua vao so dien thoai
    async findUserByPhone(phone : string) {
       return this.prisma.user.findUnique({ where : { phone } });
    }

    //Tim goi tap dang kich hoat cua hoi vien
    async findActiveMembershipByUserId(userId : number) {
        return this.prisma.membership.findFirst({
            where: {
                user_id : userId,
                is_active : true,
                status : 'ACTIVE',
            },
            include : {
                plan : true,
            },
        });
    }

    //Luu ban ghi checkin moi
    async createCheckIn(userId : number, branchId : number) {
         return this.prisma.checkIn.create({
            data : {
                userId : userId,
                branchId : branchId,
            },
            include : {
                user : {
                    select : { id : true, name : true, email : true, phone : true, avatarUrl : true}
                }
            }
         });
    }

    //Lich su checkin cua rieng 1 hoi vien
    async findHistoryByUserId(userId : number, skip : number, take : number) {
        return this.prisma.checkIn.findMany({
            where : { userId },
            skip,
            take,
            orderBy : { checkInAt : 'desc'}
        });
    }

    async countHistoryByUserId(userId : number) {
        return this.prisma.checkIn.count({
            where : { userId },
        });
    }

    // Xem lịch sử check-in của toàn phòng tập (Admin/Staff)
    async findAllHistory(where: any, skip: number, take: number) {
        return this.prisma.checkIn.findMany({
            where,
            skip,
            take,
            orderBy: { checkInAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        avatarUrl: true
                    }
                }
            }
        });
    }
    async countAllHistory(where: any) {
        return this.prisma.checkIn.count({ where });
    }
}