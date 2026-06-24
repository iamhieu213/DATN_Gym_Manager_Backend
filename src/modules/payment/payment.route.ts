import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
    payInvoice,
    confirmCashPayment,
    handleVnpayIpn,
    handleVnpayReturn,
    getMyHistory,
    adminGetPayments,
    getPaymentDetail
} from './payment.controller';

const router = Router();

// Không dùng auth cho VNPAY callbacks
router.get('/vnpay-ipn', handleVnpayIpn);
router.get('/vnpay-return', handleVnpayReturn);

router.use(authMiddleware);

// Admin / Staff
router.get('/list', adminGetPayments); // Lấy toàn bộ danh sách hóa đơn
router.post('/:paymentId/confirm', confirmCashPayment); // Xác nhận tiền mặt tại quầy

// Hội viên
router.post('/:paymentId/pay', payInvoice); // Gửi cổng thanh toán & sinh link
router.get('/my-history', getMyHistory); // Lịch sử giao dịch
router.get('/:paymentId', getPaymentDetail);

export default router;
