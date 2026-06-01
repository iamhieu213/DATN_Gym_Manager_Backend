import { EquipmentStatus } from '@prisma/client';

export interface CreateEquipmentDto {
    name: string;
    baseCode: string;      // Tiền tố của mã máy (Ví dụ: "EQ-TM")
    quantity: number;      // Số lượng cần tạo hàng loạt
    purchaseDate?: string;  // Định dạng YYYY-MM-DD
    note?: string;
}

export interface UpdateEquipmentDto {
    status?: EquipmentStatus;
    note?: string;
    lastMaintenanceDate?: string; // Định dạng YYYY-MM-DD
}

export interface BulkUpdateEquipmentDto {
    ids: number[];
    status?: EquipmentStatus;
    note?: string;
    lastMaintenanceDate?: string;
}

export interface BulkDeleteEquipmentDto {
    ids: number[];
}

export interface ListQueryEquipmentDetailDto {
    search?: string;
    status?: EquipmentStatus;
    page?: string;
    limit?: string;
}