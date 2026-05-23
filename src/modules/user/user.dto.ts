import { UserRole, UserStatus } from "@prisma/client";

export interface ListUserQueryDto {
    page?: string;
    limit?: string;
    search? : string;
    role? : UserRole;
    status? : UserStatus;
}

export interface UserListItemDto {
    id: number;
    email: string;
    name: string;
    phone: string;
    dateOfBirth: Date;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
}

export interface PaginatedUserListDto {
    data: UserListItemDto[];
    meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

//Cap nhat thong tin ca nhan
export interface UpdateProfileDto {
    name?: string;
    phone?: string;
    dateOfBirth?: Date;
}

//DTO cho ADMIN/STAFF tao tai khoan moi 
export interface CreateUserDto {
    email: string;
    password?: string;
    name: string;
    phone?: string;
    dateOfBirth?: Date;
    role?: UserRole;
    status?: UserStatus;
}

//Cap nhat thong tin nguoi dung bat ky (ADMIN/STAFF)
export interface UpdateUserDto {
    name?: string;
    phone?: string;
    dateOfBirth?: Date;
    role?: UserRole;
}

//Cap nhat trang thai rieng cua nguoi dung
export interface UpdateStatusDto {
    status : UserStatus;
}