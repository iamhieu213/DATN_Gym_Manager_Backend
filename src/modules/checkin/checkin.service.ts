import { CheckInRepository } from "./checkin.repository";
import { redisService } from "../../services/redis.service";
import { ListCheckInQueryDto } from "./checkin.dto";

export class CheckInService {
    constructor(private readonly checkInRepository: CheckInRepository) { }

    //Thuc hien checkin
     public async checkIn(phone: string, branchId : number) {
        // 1. Tìm user theo số điện thoại
        const user = await this.checkInRepository.findUserByPhone(phone);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const userId = user.id;
        // 2. Kiểm tra gói tập active (Ưu tiên đọc từ Redis trước cho nhanh)
        const redisKey = redisService.key("membership:active", userId);
        const cached = await redisService.get(redisKey);
        
        let activePlan = null;
        
        if (cached) {
            activePlan = JSON.parse(cached);
        } else {
            // Nếu Redis mất cache hoặc chưa có, tìm trong DB
            const dbMembership = await this.checkInRepository.findActiveMembershipByUserId(userId);
            if (!dbMembership) {
                throw new Error("NO_ACTIVE_MEMBERSHIP");
            }
            // Gói tập phải còn hạn sử dụng
            const today = new Date();
            if (dbMembership.end_date < today) {
                throw new Error("MEMBERSHIP_EXPIRED");
            }
            // Lưu bù cache lên Redis với thời gian hết hạn bằng ngày hết hạn gói tập
            const ttlInSeconds = Math.floor((dbMembership.end_date.getTime() - Date.now()) / 1000);
            if (ttlInSeconds > 0) {
                activePlan = {
                    membershipId: dbMembership.id,
                    planId: dbMembership.plan_id,
                    planName: dbMembership.plan.name,
                    startDate: dbMembership.start_date,
                    endDate: dbMembership.end_date
                };
                await redisService.set(redisKey, JSON.stringify(activePlan), ttlInSeconds);
            } else {
                throw new Error("MEMBERSHIP_EXPIRED");
            }
        }
        // 3. Ghi nhận lịch sử check-in vào Database (Cho tập bao nhiêu lần tùy thích)
        const checkInRecord = await this.checkInRepository.createCheckIn(userId, branchId);
        // 4. Trả về thông tin chào mừng
        return {
            checkInId: checkInRecord.id,
            checkInAt: checkInRecord.checkInAt,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                avatarUrl: user.avatarUrl
            },
            membership: activePlan
        };
    }

    // Lấy lịch sử cá nhân của hội viên
    public async getMyHistory(userId: number, pageNum: number, limitNum: number) {
        const skip = (pageNum - 1) * limitNum;
        const [records, total] = await Promise.all([
            this.checkInRepository.findHistoryByUserId(userId, skip, limitNum),
            this.checkInRepository.countHistoryByUserId(userId)
        ]);
        return {
            data: records,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            }
        };
    }
    // Lấy lịch sử toàn phòng tập cho Admin/Staff
    public async getAllHistory(role: string, actorBranchId : number | null | undefined, query: ListCheckInQueryDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error("FORBIDDEN");
        }
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;
        const where: any = {};

        if(role === 'STAFF'){
            where.branchId = actorBranchId ?? undefined;
        } else if(role === 'ADMIN' && query.branchId) {
            where.branchId = Number(query.branchId);
        }
        
        if (query.search) {
            where.user = {
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                    { phone: { contains: query.search, mode: 'insensitive' } }
                ]
            };
        }
        const [records, total] = await Promise.all([
            this.checkInRepository.findAllHistory(where, skip, limit),
            this.checkInRepository.countAllHistory(where)
        ]);
        return {
            data: records,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}