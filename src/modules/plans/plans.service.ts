import { CreatePlanDto, UpdatePlanDto, ListPlanQueryDto } from './plans.dto';
import { PlansRepository } from './plans.repository';

export class PlansService {
    constructor(private readonly plansRepository: PlansRepository) { }

    private verifyAdminOrStaff(role: string) {
        if (role !== 'ADMIN') {
            throw new Error("FORBIDDEN");
        }
    }

    //Hien thi tat ca goi tap voi dieu kien tim kiem va phan trang
    public async getAllPlans(query: ListPlanQueryDto) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;
        const where: any = {};

        if (query.is_active !== undefined) {
            where.is_active = query.is_active === 'true';
        }
        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } }
            ];
        }
        const [plans, total] = await Promise.all([
            this.plansRepository.findMany(where, skip, limit),
            this.plansRepository.count(where)
        ]);
        return {
            data: plans,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    //Hien thi 1 goi tap
    public async getPlanById(id: number) {
        const plan = await this.plansRepository.findById(id);

        if (!plan) {
            throw new Error("PLAN_NOT_FOUND");
        }

        return plan;
    }

    //Them goi tap
    public async createPlan(role: string, dto: CreatePlanDto) {
        this.verifyAdminOrStaff(role);
        if (!dto.name || dto.price === undefined || dto.duration_days === undefined) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }

        // Kiểm tra xem mã code đã tồn tại chưa
        const existed = await this.plansRepository.findByCode(dto.code);
        if (existed) {
            throw new Error("PLAN_CODE_ALREADY_EXISTS");
        }

        return this.plansRepository.create(dto);
    }

    //Update goi tap
    // Đổi string thành number ở tham số id
    public async updatePlan(role: string, id: number, dto: UpdatePlanDto) {
        this.verifyAdminOrStaff(role);
        const existed = await this.plansRepository.findById(id);
        if (!existed) {
            throw new Error("PLAN_NOT_FOUND");
        }

        if (dto.code && dto.code !== existed.code) {
            const duplicate = await this.plansRepository.findByCode(dto.code);
            if (duplicate) {
                throw new Error("PLAN_CODE_ALREADY_EXISTS");
            }
        }
        return this.plansRepository.update(id, dto);
    }

    //Mo goi tap
    public async activate(id: number, role: string) {
        const plan = await this.plansRepository.findById(id);

        if (!plan) throw new Error("PLAN_NOT_FOUND");

        return await this.plansRepository.isActivate(id, true);
    }

    public async deactivate(id: number, role: string) {
        const plan = await this.plansRepository.findById(id);

        if (!plan) throw new Error("PLAN_NOT_FOUND");

        return await this.plansRepository.isActivate(id, false);
    }

}
