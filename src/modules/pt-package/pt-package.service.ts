import { PtPackageRepository } from "./pt-package.repository";
import { CreatePtPackageDto, UpdatePtPackageDto, SetCoachPackagePriceDto, ListPackageCoachQueryDto } from "./pt-package.dto";
import { TrainingGoal } from '@prisma/client';

export class PtPackageService {
    constructor(private readonly repository: PtPackageRepository) { }

    public async getAllPackages(goal?: string) {
        const where: any = { isActive: true };
        if (goal) {
            where.goal = goal as TrainingGoal;
        }

        return this.repository.findMany(where);
    }

    //Xem danh sach PT day goi cu the + kem loc thoi gian ranh
    public async getCoachesForPackage(id: number, query: ListPackageCoachQueryDto) {
        const exists = await this.repository.findById(id);

        if (!exists) throw new Error("PACKAGE_NOT_FOUND");
        return this.repository.findPackageCoachesAndPrices(id, query);
    }

    //Admin tao goi tap moi
    public async createPackage(role: string, dto: CreatePtPackageDto) {
        if (role !== 'ADMIN') throw new Error("FORBIDDEN");

        if (!dto.code) throw new Error("MISSING_REQUIRED_FIELDS");
        // Kiểm tra trùng mã gói PT
        const existed = await this.repository.findByCode(dto.code);
        if (existed) {
            throw new Error("PACKAGE_CODE_ALREADY_EXISTS");
        }
        return this.repository.create(dto);
    }

    //Admin cap nhat goi tap
    public async updatePackage(role: string, id: number, dto: UpdatePtPackageDto) {
        if (role !== 'ADMIN') throw new Error("FORBIDDEN");
        
        const existed = await this.repository.findById(id);
        if (!existed) {
            throw new Error("PACKAGE_NOT_FOUND");
        }

        if (dto.code && dto.code !== existed.code) {
            const duplicate = await this.repository.findByCode(dto.code);
            if (duplicate) {
                throw new Error("PACKAGE_CODE_ALREADY_EXISTS");
            }
        }

        return this.repository.update(id, dto);
    }

    //Admin thiet lap gia goi tap cho PT
    public async setCoachPrice(role: string, dto: SetCoachPackagePriceDto) {
        if (role !== 'ADMIN') throw new Error("FORBIDDEN");

        return this.repository.upsertPrice(dto);
    }
}