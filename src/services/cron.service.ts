import { prisma } from "../config/client";

export const startCleanupCron = () => {
    // Thiết lập chạy định kỳ mỗi 1 phút (1 * 60 * 1000 ms)
    setInterval(async () => {
        try {
            console.log("[Cron Job] Bắt đầu quét dọn dẹp hóa đơn hết hạn...");
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

            // 1. Tìm các hóa đơn PENDING quá 10 phút chưa thanh toán qua cổng online (VNPAY, MOMO, BANK_TRANSFER)
            // (Không quét CASH vì CASH được duyệt thủ công bởi Staff/Admin tại quầy)
            const expiredPayments = await prisma.payment.findMany({
                where: {
                    status: "PENDING",
                    method: {
                        in: ["VNPAY", "MOMO", "BANK_TRANSFER"]
                    },
                    created_at: {
                        lt: tenMinutesAgo
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

                // 2. Thực hiện xóa cứng (Hard Delete) khỏi database trong 1 Transaction
                await prisma.$transaction([
                    prisma.payment.deleteMany({
                        where: { id: { in: paymentIds } }
                    }),
                    prisma.membership.deleteMany({
                        where: { id: { in: membershipIds } }
                    }),
                    prisma.coachAssignment.deleteMany({
                        where: { id: { in: coachAssignmentIds } }
                    })
                ]);

                console.log(`[Cron Job] Đã xóa thành công ${expiredPayments.length} hóa đơn và gói tập/PT hết hạn khỏi hệ thống.`);
            } else {
                console.log("[Cron Job] Không có hóa đơn nào quá hạn.");
            }
        } catch (error) {
            console.error("[Cron Job Error] Lỗi trong quá trình quét dọn dẹp hóa đơn:", error);
        }
    }, 60 * 1000); 
};
