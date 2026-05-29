import { PaymentMethod } from "@prisma/client";

export interface BuyMembershipDto {
    planId: number;
    paymentMethod: PaymentMethod;
}

export interface UpgradeMembershipDto {
    newPlanId : number;
    paymentMethod: PaymentMethod;
}

export interface ConfirmPaymentDto {
    note? : string;
}

export interface CancelMembershipDto {
    reason? : string;
}

export interface ListMembershipQueryDto {
    search? : string;
    status? : string;
    page? : string;
    limit? : string;
}