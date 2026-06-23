import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { PaymentService } from './payment.service';
import { PaymentRepository } from './payment.repository';
import { prisma } from '../../config/client';
import { vnpayService } from '../../services/vnpay.service';
import { MembershipsService } from '../membership/membership.service';
import { MembershipRepository } from '../membership/membership.repository';
import { PtBookingService } from '../pt-booking/pt-booking.service';
import { PtBookingRepository } from '../pt-booking/pt-booking.repository';
import { PtPackageRepository } from '../pt-package/pt-package.repository';
import { ListPaymentsQueryDto } from './payment.dto'; 

const repository = new PaymentRepository(prisma);
const membershipService = new MembershipsService(new MembershipRepository(prisma));
const ptBookingService = new PtBookingService(new PtBookingRepository(prisma), new PtPackageRepository(prisma));

const service = new PaymentService(repository, membershipService, ptBookingService);

// Phản hồi mã lỗi
const mapError = (msg: string) => {
    switch (msg) {
        case "PAYMENT_NOT_FOUND": return { status: 404, message: "Không tìm thấy hóa đơn." };
        case "PAYMENT_ALREADY_PROCESSED": return { status: 400, message: "Hóa đơn này đã được xử lý." };
        case "FORBIDDEN": return { status: 403, message: "Bạn không có quyền thực hiện hành động này." };
        default: return { status: 500, message: "Lỗi máy chủ. Vui lòng thử lại sau." };
    }
};

// Hội viên chọn cổng thanh toán & sinh link thanh toán
export const payInvoice = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");

        const paymentId = parseInt(req.params.paymentId as string, 10);
        if (isNaN(paymentId)) {
            return res.status(400).json({ success: false, message: "Mã hóa đơn không hợp lệ." });
        }

        const payment = await service.payInvoice(userId, paymentId);
        const clientIp = req.ip || "127.0.0.1";
        const paymentUrl = vnpayService.createPaymentUrl(
            payment.id,
            Number(payment.amount),
            clientIp,
            `Thanh toan hoa don ID: ${payment.id}`
        );

        res.status(200).json({
            success: true,
            message: "Tạo link thanh toán VNPAY thành công.",
            data: { paymentId: payment.id, amount: payment.amount, paymentUrl }
        });
    } catch (e: any) {
        console.error("Error in payInvoice:", e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// Lễ tân duyệt tiền mặt tại quầy
export const confirmCashPayment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        const actorBranchId = req.user?.branchId;

        if (!role) throw new Error("FORBIDDEN");

        const paymentId = parseInt(req.params.paymentId as string, 10);
        if (isNaN(paymentId)) {
            return res.status(400).json({ success: false, message: "Mã hóa đơn không hợp lệ." });
        }

        const { branchId } = req.body;

        const confirmDto = {
            transactionRef: `CASH_CONFIRMED_BY_${role}`,
            gatewayResponse: { confirmedBy: role },
            ...(branchId ? { branchId: Number(branchId) } : {}) // Chỉ thêm thuộc tính branchId vào nếu nó có giá trị thực tế
        };

        await service.confirmPayment(
            role, 
            actorBranchId,  
            paymentId, 
            confirmDto
        );

        res.status(200).json({ success: true, message: "Duyệt thanh toán tiền mặt thành công." });
    } catch (e: any) {
        console.error("Error in confirmCashPayment:", e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// VNPAY IPN Webhook
export const handleVnpayIpn = async (req: Request, res: Response) => {
    try {
        const vnp_Params = req.query;
        const isValidSignature = vnpayService.verifyResponse({ ...vnp_Params });
        if (!isValidSignature) {
            return res.status(200).json({ RspCode: "97", Message: "Invalid Signature" });
        }

        const paymentId = parseInt(vnp_Params["vnp_TxnRef"] as string, 10);
        const amount = parseFloat(vnp_Params["vnp_Amount"] as string) / 100;
        const responseCode = vnp_Params["vnp_ResponseCode"] as string;
        const transactionNo = vnp_Params["vnp_TransactionNo"] as string;

        const payment = await repository.findPaymentById(paymentId);
        if (!payment) return res.status(200).json({ RspCode: "01", Message: "Order not found" });
        if (Number(payment.amount) !== amount) return res.status(200).json({ RspCode: "04", Message: "Invalid Amount" });
        if (payment.status !== "PENDING") return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });

        if (responseCode === "00") {
            await service.confirmPayment("SYSTEM", null, paymentId, { transactionRef: transactionNo, gatewayResponse: vnp_Params });
            return res.status(200).json({ RspCode: "00", Message: "Confirm success" });
        } else {
            await repository.updatePayment(paymentId, { status: "FAILED", gateway_response: vnp_Params });
            return res.status(200).json({ RspCode: "00", Message: "Confirm success (Failed Payment)" });
        }
    } catch (e) {
        console.error("Error in handleVnpayIpn:", e);
        return res.status(200).json({ RspCode: "99", Message: "System Error" });
    }
};

// VNPAY Callback Return URL (Hiển thị UI kết quả)
export const handleVnpayReturn = async (req: Request, res: Response) => {
    try {
        const vnp_Params = req.query;
        const isValidSignature = vnpayService.verifyResponse({ ...vnp_Params });
        if (!isValidSignature) return res.send("<h1>Lỗi: Chữ ký không hợp lệ!</h1>");

        const responseCode = vnp_Params["vnp_ResponseCode"] as string;
        const paymentId = parseInt(vnp_Params["vnp_TxnRef"] as string, 10);
        const transactionNo = vnp_Params["vnp_TransactionNo"] as string;

        const payment = await repository.findPaymentById(paymentId);
        if (responseCode === "00") {
            if (payment && payment.status === "PENDING") {
                await service.confirmPayment("SYSTEM", null, paymentId, { transactionRef: transactionNo, gatewayResponse: vnp_Params });
            }
            return res.send(`<div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                <h1 style="color: green;">🎉 THANH TOÁN THÀNH CÔNG!</h1>
                <p>Giao dịch của bạn đã được xác nhận tự động.</p>
                <p>Mã giao dịch: <strong>${transactionNo}</strong></p>
            </div>`);
        } else {
            if (payment && payment.status === "PENDING") {
                await repository.updatePayment(paymentId, { status: "FAILED", gateway_response: vnp_Params });
            }
            return res.send(`<div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                <h1 style="color: red;">❌ THANH TOÁN THẤT BẠI</h1>
                <p>Mã lỗi từ VNPAY: <strong>${responseCode}</strong></p>
            </div>`);
        }
    } catch (e) {
        console.error("Error in handleVnpayReturn:", e);
        return res.send("<h1>Lỗi máy chủ khi xử lý callback VNPAY</h1>");
    }
};

// Hội viên xem lịch sử giao dịch
export const getMyHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("FORBIDDEN");
        const data = await service.getMyHistory(userId);
        res.status(200).json({ success: true, data });
    } catch (e: any) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// Admin xem và lọc giao dịch
export const adminGetPayments = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("FORBIDDEN");
        // Nhận toàn bộ query params truyền lên từ URL và ép kiểu sang ListPaymentsQueryDto
        const query = req.query as unknown as ListPaymentsQueryDto;
        const result = await service.adminGetPayments(role, req.user?.branchId, query);
        res.status(200).json({ 
            success: true, 
            data: result.data,
            meta: result.meta 
        });
    } catch (e: any) {
        console.error("Error in adminGetPayments:", e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};

// GET /payments/:paymentId
export const getPaymentDetail = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId || !role) throw new Error("FORBIDDEN");

        const paymentId = parseInt(req.params.paymentId as string, 10);
        if (isNaN(paymentId)) {
            return res.status(400).json({ success: false, message: "Mã hóa đơn không hợp lệ." });
        }

        // Gọi service xử lý phân quyền và lấy dữ liệu
        const data = await service.findPaymentById(userId, role, req.user?.branchId, paymentId);

        res.status(200).json({ 
            success: true, 
            data 
        });
    } catch (e: any) {
        console.error("Error in getPaymentDetail:", e);
        const error = mapError(e.message);
        res.status(error.status).json({ success: false, message: error.message });
    }
};
