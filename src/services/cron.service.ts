import { prisma } from "../config/client";

export const startCleanupCron = () => {
    // Thiết lập chạy định kỳ mỗi 1 phút (1 * 60 * 1000 ms)
    setInterval(async () => {
        try {
            console.log("[Cron Job] Bắt đầu quét dọn dẹp hóa đơn online hết hạn...");
            const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

            // 1. Tìm các hóa đơn PENDING quá 15 phút chưa thanh toán qua cổng online (VNPAY, MOMO, BANK_TRANSFER)
            // (Không quét CASH vì CASH được duyệt thủ công bởi Staff/Admin tại quầy)
            const expiredPayments = await prisma.payment.findMany({
                where: {
                    status: "PENDING",
                    method: {
                        in: ["VNPAY", "MOMO", "BANK_TRANSFER"]
                    },
                    created_at: {
                        lt: fifteenMinutesAgo
                    }
                }
            });

            if (expiredPayments.length > 0) {
                const paymentIds = expiredPayments.map((p) => p.id);
                const membershipIds = expiredPayments
                    .map((p) => p.membership_id)
                    .filter((id): id is number => id !== null);
                const coachAssignmentIds = expiredPayments
                    .map((p) => p.coach_assignment_id)
                    .filter((id): id is number => id !== null);

                // 2. Thực hiện cập nhật trạng thái trong 1 Transaction
                await prisma.$transaction(async (tx) => {
                    // Cập nhật trạng thái Payment sang FAILED
                    await tx.payment.updateMany({
                        where: { id: { in: paymentIds } },
                        data: { status: "FAILED" }
                    });

                    // Cập nhật hợp đồng PT (CoachAssignment) sang CANCELLED
                    if (coachAssignmentIds.length > 0) {
                        await tx.coachAssignment.updateMany({
                            where: { id: { in: coachAssignmentIds } },
                            data: { status: "CANCELLED" }
                        });
                    }

                    // Cập nhật trạng thái gói hội viên thường (Membership) sang CANCELLED và is_active = false
                    if (membershipIds.length > 0) {
                        await tx.membership.updateMany({
                            where: { id: { in: membershipIds } },
                            data: {
                                status: "CANCELLED",
                                is_active: false
                            }
                        });
                    }
                });

                console.log(`[Cron Job] Đã tự động hủy thành công ${expiredPayments.length} hóa đơn online quá hạn 15p.`);
            } else {
                console.log("[Cron Job] Không có hóa đơn nào quá hạn.");
            }
        } catch (error) {
            console.error("[Cron Job Error] Lỗi trong quá trình quét dọn dẹp hóa đơn:", error);
        }
    }, 60 * 1000); 
};
