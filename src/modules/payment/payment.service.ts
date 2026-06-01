import { PaymentRepository } from './payment.repository';
import { MembershipsService } from '../membership/membership.service';
import { PtBookingService } from '../pt-booking/pt-booking.service';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class PaymentService {
    constructor(
        private readonly repository: PaymentRepository,
        private readonly membershipService: MembershipsService,
        private readonly ptBookingService: PtBookingService
    ) { }

    // 1. Hội viên lấy thông tin thanh toán online
    public async payInvoice(userId: number, paymentId: number) {
        const payment = await this.repository.findPaymentById(paymentId);
        if (!payment || payment.user_id !== userId) {
            throw new Error("PAYMENT_NOT_FOUND");
        }
        if (payment.status !== "PENDING") {
            throw new Error("PAYMENT_ALREADY_PROCESSED");
        }
        
        // Tự động chuyển đổi phương thức thanh toán sang VNPAY nếu hóa đơn đang ở hình thức khác (ví dụ CASH)
        if (payment.method !== "VNPAY") {
            return this.repository.updatePayment(paymentId, { method: "VNPAY" });
        }
        return payment;
    }

    // 2. Kích hoạt hóa đơn (Gọi từ VNPAY hoặc Admin xác nhận)
    public async confirmPayment(role: string, paymentId: number, transactionRef: string, gatewayResponse?: any) {
        const payment = await this.repository.findPaymentById(paymentId);
        if (!payment) throw new Error("PAYMENT_NOT_FOUND");
        if (payment.status !== "PENDING") throw new Error("PAYMENT_ALREADY_PROCESSED");

        // Điều phối sang các service nghiệp vụ chuyên biệt (các service này tự chạy transaction cập nhật Payment sang PAID)
        if (payment.membership_id) {
            await this.membershipService.confirmPayment("ADMIN", paymentId, transactionRef, gatewayResponse);
        } else if (payment.coach_assignment_id) {
            await this.ptBookingService.confirmPayment("ADMIN", paymentId, transactionRef, gatewayResponse);
        } else {
            // Trường hợp hóa đơn vãng lai khác (nếu có)
            await this.repository.updatePayment(paymentId, {
                status: "PAID",
                paid_at: new Date(),
                transaction_ref: transactionRef,
                gateway_response: gatewayResponse
            });
        }

        // Lấy lại hóa đơn đã cập nhật trạng thái PAID từ DB để trả về
        const updatedPayment = await this.repository.findPaymentById(paymentId);
        if (!updatedPayment) throw new Error("PAYMENT_NOT_FOUND");
        return updatedPayment;
    }

    // 3. Lấy lịch sử giao dịch của hội viên
    public async getMyHistory(userId: number) {
        return this.repository.findUserPayments(userId);
    }

    // 4. Admin xem toàn bộ giao dịch
    public async adminGetPayments(role: string, status?: any) {
        if (role !== "ADMIN" && role !== "STAFF") {
            throw new Error("FORBIDDEN");
        }
        return this.repository.findAllPayments(status);
    }
}
