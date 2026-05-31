import { PtPackageRepository } from "./pt-package.repository";
import { CreatePtPackageDto, UpdatePtPackageDto, SetCoachPackagePriceDto, ListPackageCoachQueryDto, ListPtPackageQueryDto } from "./pt-package.dto";
import { TrainingGoal } from '@prisma/client';

export class PtPackageService {
    constructor(private readonly repository: PtPackageRepository) { }

    public async getAllPackages(role: string, query: ListPtPackageQueryDto) {
        const where: any = {};
        if (role === 'ADMIN') {
            if (query.isActive !== undefined) {
                where.isActive = query.isActive === 'true';
            }
        } else {
            where.isActive = true;
        }

        if (query.goal) {
            where.goal = query.goal as TrainingGoal;
        }

        return this.repository.findMany(where);
    }

    //Xem danh sach PT day goi cu the + kem loc thoi gian ranh
    public async getCoachesForPackage(id: number, query: ListPackageCoachQueryDto, role: string) {
        const exists = await this.repository.findById(id);
        // 1. Kiểm tra gói tập có tồn tại trong DB không
        if (!exists) throw new Error("PACKAGE_NOT_FOUND");

        // 2. Bảo mật: Nếu gói tập đã bị TẮT (isActive = false) và người xem KHÔNG PHẢI ADMIN
        // -> Báo lỗi không tìm thấy gói tập để ẩn thông tin đi.
        if (role !== 'ADMIN' && !exists.isActive) {
            throw new Error("PACKAGE_NOT_FOUND");
        }

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

    // Admin mở/khóa gói tập mẫu toàn hệ thống
    public async updatePackageStatus(role: string, id: number, isActive: boolean) {
        if (role !== 'ADMIN') throw new Error("FORBIDDEN");

        const exists = await this.repository.findById(id);
        if (!exists) throw new Error("PACKAGE_NOT_FOUND");

        return this.repository.updatePackageStatus(id, isActive);
    }

    // Admin mở/khóa quyền dạy gói của một PT cụ thể
    public async updateCoachPackageStatus(role: string, coachId: number, ptPackageId: number, isActive: boolean) {
        if (role !== 'ADMIN') throw new Error("FORBIDDEN");

        const packageExists = await this.repository.findById(ptPackageId);
        if (!packageExists) throw new Error("PACKAGE_NOT_FOUND");

        try {
            return await this.repository.updateCoachPackageStatus(coachId, ptPackageId, isActive);
        } catch (e: any) {
            if (e.code === 'P2025') {
                throw new Error("COACH_PACKAGE_RELATION_NOT_FOUND");
            }
            throw e;
        }
    }
}