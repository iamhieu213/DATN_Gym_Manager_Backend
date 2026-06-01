import { PaymentMethod } from '@prisma/client';

export interface PayInvoiceDto {
    paymentMethod: PaymentMethod;
}

export interface ListPaymentsQueryDto {
    search?: string;   // Tìm kiếm theo tên, email, sđt hội viên
    status?: string;   // Lọc theo trạng thái PENDING, PAID, FAILED
    page?: string;     // Số trang
    limit?: string;    // Số lượng bản ghi mỗi trang
}