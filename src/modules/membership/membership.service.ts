import { MembershipRepository } from "./membership.repository";
import { BuyMembershipDto, UpgradeMembershipDto, ListMembershipQueryDto } from "./membership.dto";
import { redisService } from "../../services/redis.service";

export class MembershipsService {
    constructor(private readonly repository: MembershipRepository) {}

    // 1. Đăng ký mua gói tập mới
    public async buyMembership(userId: number, dto: BuyMembershipDto) {
        const plan = await this.repository.findPlanById(dto.planId);
        if (!plan || !plan.is_active) {
            throw new Error("PLAN_NOT_FOUND");
        }

        const activeSub = await this.repository.findActiveMembershipByUserId(userId);
        if (activeSub) {
            throw new Error("ALREADY_HAVE_ACTIVE_PLAN");
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + plan.duration_days);

        const { membership, payment } = await this.repository.createMembershipAndPayment({
            userId,
            planId: plan.id,
            startDate,
            endDate,
            amount: Number(plan.price),
            method: dto.paymentMethod
        });

        return {
            membershipId: membership.id,
            paymentId: payment.id,
            amount: payment.amount,
            method: payment.method,
            status: payment.status
        };
    }

    // 2. Nâng cấp gói tập (Logic khấu trừ tiền dư còn lại theo ngày dùng)
    public async upgradeMembership(userId: number, dto: UpgradeMembershipDto) {
        const newPlan = await this.repository.findPlanById(dto.newPlanId);
        if (!newPlan || !newPlan.is_active) {
            throw new Error("PLAN_NOT_FOUND");
        }

        const activeSub = await this.repository.findActiveMembershipByUserId(userId);
        if (!activeSub) {
            throw new Error("NO_ACTIVE_PLAN_TO_UPGRADE");
        }

        // Chỉ cho phép nâng cấp lên gói đắt tiền hơn
        if (Number(newPlan.price) <= Number(activeSub.plan.price)) {
            throw new Error("CANNOT_DOWNGRADE_OR_EQUAL");
        }

        // Tính khấu trừ: giá gói cũ / tổng thời hạn * thời hạn còn lại (Làm tròn theo ngày, không theo mili-giây)
        const startOfDay = (date: Date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
        };

        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        const subStartDate = startOfDay(activeSub.start_date);
        const subEndDate = startOfDay(activeSub.end_date);
        const today = startOfDay(new Date());

        const totalDays = Math.round((subEndDate.getTime() - subStartDate.getTime()) / ONE_DAY_MS);
        const remainingDays = Math.round((subEndDate.getTime() - today.getTime()) / ONE_DAY_MS);
        const remainingDaysCapped = Math.max(0, Math.min(totalDays, remainingDays));

        let remainingValue = 0;
        if (totalDays > 0) {
            remainingValue = (remainingDaysCapped / totalDays) * Number(activeSub.plan.price);
        }

        let amountToPay = Number(newPlan.price) - remainingValue;
        if (amountToPay < 0) amountToPay = 0;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + newPlan.duration_days);

        const { membership, payment } = await this.repository.upgradeMembershipAndPayment({
            userId,
            activeMembershipId: activeSub.id,
            newPlanId: newPlan.id,
            startDate,
            endDate,
            amount: Math.round(amountToPay),
            method: dto.paymentMethod
        });

        return {
            membershipId: membership.id,
            paymentId: payment.id,
            amount: payment.amount,
            remainingValue: Math.round(remainingValue),
            method: payment.method,
            status: payment.status
        };
    }

    // 3. Xác nhận đã đóng tiền & Kích hoạt gói tập + Cập nhật Redis Cache
    public async confirmPayment(role: string, actorBranchId: number | null | undefined, paymentId: number, transactionRef?: string, gatewayResponse?: any) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error("FORBIDDEN");
        }

        const payment = await this.repository.findPaymentById(paymentId);
        if (!payment) {
            throw new Error("PAYMENT_NOT_FOUND");
        }

        if (payment.status !== 'PENDING') {
            throw new Error("PAYMENT_ALREADY_PROCESSED");
        }

        if (payment.membership_id) {
            const { payment: updatedPayment, membership } = await this.repository.activateMembershipPayment(
                paymentId,
                transactionRef ?? `CASH_CONFIRMED_BY_${role}`,
                gatewayResponse ?? { confirmedBy: role },
                role === 'STAFF' ? actorBranchId : null
            );

            // --- LƯU THÔNG TIN GÓI TẬP ACTIVE LÊN REDIS (Để điểm danh/check-in) ---
            const redisKey = redisService.key("membership:active", updatedPayment.user_id);
            const ttlInSeconds = Math.floor((membership.end_date.getTime() - Date.now()) / 1000);

            if (ttlInSeconds > 0) {
                const cacheValue = {
                    membershipId: membership.id,
                    planId: membership.plan_id,
                    planName: (membership as any).plan.name,
                    startDate: membership.start_date,
                    endDate: membership.end_date
                };
                await redisService.set(redisKey, JSON.stringify(cacheValue), ttlInSeconds);
            }

            return {
                payment: updatedPayment,
                membership
            };
        } else if (payment.coach_assignment_id) {
            const ptPackage = await this.repository.findPtPackageByAssignmentId(payment.coach_assignment_id);
            const durationDays = ptPackage?.durationDays ?? 30;

            const { payment: updatedPayment, assignment } = await this.repository.activatePtPayment(
                paymentId,
                transactionRef ?? `CASH_CONFIRMED_BY_${role}`,
                durationDays,
                gatewayResponse ?? { confirmedBy: role }
            );

            // --- LƯU THÔNG TIN GÓI PT ACTIVE LÊN REDIS ---
            const redisKey = redisService.key("pt_assignment:active", updatedPayment.user_id);
            const ttlInSeconds = durationDays * 24 * 60 * 60;
            await redisService.set(redisKey, JSON.stringify(assignment), ttlInSeconds);

            return {
                payment: updatedPayment,
                coachAssignment: assignment
            };
        } else {
            throw new Error("INVALID_PAYMENT_TYPE");
        }
    }

    // 4. Hủy gói tập (Xóa cả cache Redis tương ứng)
    public async cancelMembership(role: string, id: number) {
        if (role !== 'ADMIN') {
            throw new Error("FORBIDDEN");
        }

        const membership = await this.repository.findMembershipById(id);
        if (!membership) {
            throw new Error("MEMBERSHIP_NOT_FOUND");
        }

        if (membership.status !== 'ACTIVE') {
            throw new Error("MEMBERSHIP_NOT_ACTIVE");
        }

        const updated = await this.repository.cancelMembership(id);

        // --- XÓA KHỎI CACHE REDIS ---
        const redisKey = redisService.key("membership:active", membership.user_id);
        await redisService.del(redisKey);

        return updated;
    }

    // 5. Xem gói active (Ưu tiên đọc từ Redis trước cho nhanh)
    public async getActiveMembership(userId: number) {
        const redisKey = redisService.key("membership:active", userId);
        const cached = await redisService.get(redisKey);
        
        if (cached) {
            return JSON.parse(cached); // Trả về luôn từ bộ nhớ RAM
        }

        const activeSub = await this.repository.findActiveMembershipByUserId(userId);
        if (!activeSub) return null;

        // Lưu bù vào Redis cache nếu chưa có sẵn
        const ttlInSeconds = Math.floor((activeSub.end_date.getTime() - Date.now()) / 1000);
        if (ttlInSeconds > 0) {
            const cacheValue = {
                membershipId: activeSub.id,
                planId: activeSub.plan_id,
                planName: activeSub.plan.name,
                startDate: activeSub.start_date,
                endDate: activeSub.end_date
            };
            await redisService.set(redisKey, JSON.stringify(cacheValue), ttlInSeconds);
        }

        return activeSub;
    }

    public async getMyHistory(userId: number) {
        return this.repository.findUserHistory(userId);
    }

    public async getAllMemberships(role: string, query: ListMembershipQueryDto) {
        if (role !== 'ADMIN' && role !== 'STAFF') {
            throw new Error("FORBIDDEN");
        }

        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.status) {
            where.status = query.status;
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

        const [memberships, total] = await Promise.all([
            this.repository.findMany(where, skip, limit),
            this.repository.count(where)
        ]);

        return {
            data: memberships,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
}