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
                },
                include: {
                    coachAssignment: true
                }
            });

            if (expiredPayments.length > 0) {
                // 2. Thực hiện cập nhật trạng thái trong 1 Transaction
                await prisma.$transaction(async (tx) => {
                    for (const payment of expiredPayments) {
                        if (payment.coach_assignment_id && payment.coachAssignment) {
                            const assignment = payment.coachAssignment;

                            // CHỈ XỬ LÝ HỦY nếu đây là hóa đơn đăng ký mới (hợp đồng gốc đang PENDING)
                            if (assignment.status === "PENDING") {
                                // Chuyển hóa đơn sang FAILED
                                await tx.payment.update({
                                    where: { id: payment.id },
                                    data: { status: "FAILED" }
                                });

                                // Hủy hợp đồng PENDING đăng ký mới
                                await tx.coachAssignment.update({
                                    where: { id: assignment.id },
                                    data: { status: "CANCELLED" }
                                });
                            }
                            
                            // NẾU assignment.status === "ACTIVE" (hóa đơn đóng thêm tiền đổi gói): 
                            // Cron Job sẽ BỎ QUA không tự động hủy sau 15 phút, cho phép hội viên thanh toán muộn hơn.
                        }

                        // Đối với Membership thường nếu hết hạn: Chuyển hóa đơn sang FAILED và Xóa cứng Membership
                        if (payment.membership_id) {
                            await tx.payment.update({
                                where: { id: payment.id },
                                data: { status: "FAILED" }
                            });
                            await tx.membership.deleteMany({
                                where: { id: payment.membership_id }
                            });
                        }
                    }
                });

                console.log(`[Cron Job] Đã quét và xử lý dọn dẹp xong ${expiredPayments.length} hóa đơn online quá hạn 15p.`);
            } else {
                console.log("[Cron Job] Không có hóa đơn nào quá hạn.");
            }
        } catch (error) {
            console.error("[Cron Job Error] Lỗi trong quá trình quét dọn dẹp hóa đơn:", error);
        }
    }, 60 * 1000); 
};
