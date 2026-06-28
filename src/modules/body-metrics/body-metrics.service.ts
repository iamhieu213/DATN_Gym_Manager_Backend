import { BodyMetricsRepository } from "./body-metrics.repository";
import { CreateBodyMetricsDto, UpdateBodyMetricsDto, ListBodyMetricQueryDto } from "./body-metrics.dto";

export class BodyMetricsService {
    constructor(private readonly bodyMetricsRepository: BodyMetricsRepository) { }

    private calculateBMI(weight: number, heightCm: number): number {
        const heightM = heightCm / 100;
        return parseFloat((weight / (heightM * heightM)).toFixed(2));
    }

    // Lấy lịch sử đo của 1 hội viên
    public async getMemberHistory(userId: number, query: ListBodyMetricQueryDto) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const where: any = { user_id: userId };

        if (query.startDate || query.endDate) {
            where.recorded_at = {};
            if (query.startDate) where.recorded_at.gte = new Date(query.startDate);
            if (query.endDate) where.recorded_at.lte = new Date(query.endDate);
        }

        const [history, total] = await Promise.all([
            this.bodyMetricsRepository.findMany(where, skip, limit),
            this.bodyMetricsRepository.count(where)
        ]);

        return {
            data: history,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    // Lấy chi tiết 1 bản ghi
    public async getMetricById(id: number) {
        const metric = await this.bodyMetricsRepository.findById(id);
        if (!metric) throw new Error("METRIC_NOT_FOUND");

        return metric;
    }

    // Thêm chỉ số mới và tự tính toán BMI
    public async addMetric(actorId: number, userId: number, dto: CreateBodyMetricsDto) {
        if (!dto.weight_kg || !dto.height_cm) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }

        const bmi = this.calculateBMI(dto.weight_kg, dto.height_cm);

        return this.bodyMetricsRepository.create({ 
            ...dto, 
            user_id: userId,
            recorded_by_id: actorId,
            bmi 
        });
    }

    // Sửa chỉ số và tự tính lại BMI nếu cân nặng hoặc chiều cao thay đổi
    public async updateMetric(id: number, dto: UpdateBodyMetricsDto) {
        const existed = await this.bodyMetricsRepository.findById(id);
        if (!existed) throw new Error("METRIC_NOT_FOUND");

        const updateData: UpdateBodyMetricsDto & { bmi?: number } = { ...dto };

        if (dto.weight_kg !== undefined || dto.height_cm !== undefined) {
            const newWeight = dto.weight_kg ?? existed.weight_kg;
            const newHeight = dto.height_cm ?? existed.height_cm;
            updateData.bmi = this.calculateBMI(newWeight, newHeight);
        }

        return this.bodyMetricsRepository.update(id, updateData);
    }

    // Xóa chỉ số
    public async deleteMetric(id: number) {
        const existed = await this.bodyMetricsRepository.findById(id);
        if (!existed) throw new Error("METRIC_NOT_FOUND");
        return this.bodyMetricsRepository.delete(id);
    }
}