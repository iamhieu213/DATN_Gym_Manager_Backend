import { constants } from 'node:buffer';
import { ListCoachQueryDto, UpdateCoachProfileDto, RegisterAvailabilityDto, ListCoachAdminQueryDto } from './coach.dto';
import { CoachRepository } from './coach.repository';

export class CoachService {
    constructor(private readonly coachRepository: CoachRepository) { }

    //Hien thi tat cac PT co kem theo dieu kien loc neu can
    public async getAllCoaches(query: ListCoachQueryDto) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const where: any = { isAvailable: true };

        //1.Loc theo dieu kien goal
        if (query.goal) {
            where.packages = {
                some: {
                    ptPackage: {
                        goal: query.goal
                    }
                }
            }
        };

        // Lọc theo gói tập cụ thể
        if (query.ptPackageId) {
            where.packages = {
                some: {
                    ptPackageId: parseInt(query.ptPackageId, 10),
                    isActive: true
                }
            };
        }

        // 2. Thuật toán: Ghép các PT có lịch trống phù hợp với khung thời gian mong muốn của người dùng
        if (query.slots) {
            try {
                const slots = typeof query.slots === 'string' ? JSON.parse(query.slots) : query.slots;
                if (Array.isArray(slots) && slots.length > 0) {
                    where.AND = slots.map((slot: any) => {
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
            where.availabilities = {
                some: {
                    dayOfWeek: day,
                    startMinutes: { lte: startMins },
                    endMinutes: { gte: endMins }
                }
            };
        }

        //3. tim kiem theo name
        if (query.search || query.branchId) {
            where.user = {
                ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
                ...(query.branchId && { branchId: Number(query.branchId) })
            };
        }

        const [coaches, total] = await Promise.all([
            this.coachRepository.findMany(where, skip, limit),
            this.coachRepository.count(where)
        ]);

        return {
            data: coaches,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        }
    }

    //Tim kiem coach theo Id
    public async getCoachById(id: number) {
        const coach = await this.coachRepository.findById(id);
        if (!coach) throw new Error("COACH_NOT_FOUND");
        return coach;
    }

    //Xem profile ca nhan
    public async getMyProfile(userId: number) {
        const profile = await this.coachRepository.getMyProfile(userId);
        if (!profile) {
            throw new Error("COACH_PROFILE_NOT_FOUND"); // Trả về lỗi chuẩn để map sang tiếng Việt
        }
        return profile;
    }

    // Xem lịch rảnh cá nhân
    public async getMyAvailability(userId: number) {
        const availabilities = await this.coachRepository.getMyAvailability(userId);
        // (Lịch rảnh có thể trống nếu chưa cấu hình, không nhất thiết phải quăng lỗi nếu account tồn tại)
        return availabilities;
    }

    public async updateMyProfile(userId: number, role: string, dto: UpdateCoachProfileDto) {
        if (role !== 'COACH') throw new Error("FORBIDDEN");
        const profile = await this.coachRepository.findByUserId(userId);
        if (!profile) throw new Error("COACH_PROFILE_NOT_FOUND");

        // Chỉ cho phép cập nhật bio và speciality, ngăn PT tự đổi trạng thái hoạt động (isAvailable)
        const updateData: UpdateCoachProfileDto = {
            ...(dto.bio !== undefined && { bio: dto.bio }),
            ...(dto.speciality !== undefined && { speciality: dto.speciality })
        };

        return this.coachRepository.updateProfile(profile.id, updateData);
    }

    public async setMyAvailability(userId: number, role: string, dto: RegisterAvailabilityDto) {
        if (role !== 'COACH') throw new Error("FORBIDDEN");

        const profile = await this.coachRepository.findByUserId(userId);
        if (!profile) throw new Error("COACH_PROFILE_NOT_FOUND");

        //Chuyen thoi gian sang phut
        const formatted = dto.availabilities.map(av => {
            const [sh = 0, sm = 0] = av.startTime.split(':').map(Number);
            const [eh = 0, em = 0] = av.endTime.split(':').map(Number);

            return {
                dayOfWeek: av.dayOfWeek,
                startTime: av.startTime,
                endTime: av.endTime,
                startMinutes: sh * 60 + sm,
                endMinuties: eh * 60 + em
            }
        });

        return this.coachRepository.updateAvailabilities(profile.id, formatted);
    }

    // Admin lấy danh sách toàn bộ PT để quản trị
    public async getAllCoachesForAdmin(role: string, actorBranchId : number | null | undefined, query: ListCoachAdminQueryDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') throw new Error("FORBIDDEN");

        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const where: any = {};

        if (query.isAvailable !== undefined) {
            where.isAvailable = query.isAvailable === 'true';
        }

        //PHAN QUYEN THEO CHI NHANH
        let targetBranchId: number | null = null;
        if(role === 'STAFF'){
            //STAFF chi duoc xem Coach cua chi nhanh minh
            if(!actorBranchId) throw new Error("STAFF_BRANCH_REQUIRED");
            targetBranchId = actorBranchId;
        }else if(role === 'ADMIN' && query.branchId) {
            targetBranchId = Number(query.branchId);
        }

        if (query.search || targetBranchId) {
            where.user = {
                ...(query.search && { name: { contains: query.search, mode: 'insensitive' } }),
                ...(targetBranchId && { branchId: targetBranchId })
            };
        }

        const [coaches, total] = await Promise.all([
            this.coachRepository.findMany(where, skip, limit),
            this.coachRepository.count(where)
        ]);

        return {
            data: coaches,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }
        };
    }

    // Admin cập nhật trạng thái hoạt động của PT
    public async updateCoachStatusByAdmin(role: string, coachId: number, isAvailable: boolean) {
        if (role !== 'ADMIN') throw new Error("FORBIDDEN");

        const coach = await this.coachRepository.findById(coachId);
        if (!coach) throw new Error("COACH_NOT_FOUND");

        return this.coachRepository.updateProfile(coachId, { isAvailable });
    }
}