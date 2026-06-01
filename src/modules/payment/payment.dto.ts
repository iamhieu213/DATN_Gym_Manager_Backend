import { PaymentMethod } from '@prisma/client';

export interface PayInvoiceDto {
    paymentMethod: PaymentMethod;
}
