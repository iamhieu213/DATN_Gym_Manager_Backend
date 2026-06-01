import { PaymentMethod } from '@prisma/client';
export interface HirePtDto {
    coachId: number;
    ptPackageId: number;
    paymentMethod: PaymentMethod;
}
export interface RequestCoachChangeDto {
    newCoachId: number;
    newPtPackageId? : number;
    paymentMethod : PaymentMethod;
    reason?: string; // Không bắt buộc khi đổi trực tiếp (chưa thanh toán)
}
export interface AdminDirectChangeCoachDto {
    assignmentId: number;
    newCoachId: number;
}