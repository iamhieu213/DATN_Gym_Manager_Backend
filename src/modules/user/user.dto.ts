import { UserRole, UserStatus, Gender } from "@prisma/client";

export interface ListUserQueryDto {
    page?: string;
    limit?: string;
    search? : string;
    role? : UserRole;
    status? : UserStatus;
    branchId? : string;
}

export interface UserListItemDto {
    id: number;
    email: string;
    name: string;
    phone: string | null;
    dateOfBirth: Date | null;
    role: UserRole;
    status: UserStatus;
    avatarUrl: string | null;
    gender: Gender | null;
    citizenId: string | null;
    address: string | null;
    emergencyContact: string | null;
    createdAt: Date;
    updatedAt: Date;
    branchId: number | null;
    branch?: { id : number, name : string, code : string } | null;
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
    gender?: Gender;
    citizenId?: string;
    address?: string;
    emergencyContact?: string;
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
    avatarUrl?: string;
    gender?: Gender;
    citizenId?: string;
    address?: string;
    emergencyContact?: string;
    branchId? : number;
}

//Cap nhat thong tin nguoi dung bat ky (ADMIN/STAFF)
export interface UpdateUserDto {
    name?: string;
    phone?: string;
    dateOfBirth?: Date;
    role?: UserRole;
    gender?: Gender;
    citizenId?: string;
    address?: string;
    emergencyContact?: string;
    branchId? : number;
}

//Cap nhat anh dai dien
export interface UpdateAvatarDto {
    avatarUrl: string;
}

//Cap nhat trang thai rieng cua nguoi dung
export interface UpdateStatusDto {
    status : UserStatus;
}

//Khoa mem tai khoan nguoi dung
export interface SoftDeleteUserDto {
    status: "DELETED";
}

export interface ResetPasswordDto {
    newPassword: string;
}

// Định dạng cấu trúc dữ liệu thống kê trả về cho Dashboard
export interface UserStatsDto {
    totalUsers: number;
    byRole: {
        ADMIN: number;
        COACH: number;
        STAFF: number;
        USER: number;
    };
    byStatus: {
        ACTIVE: number;
        INACTIVE: number;
        SUSPENDED: number;
        BANNED: number;
    };
    newRegistrations: {
        today: number;
        thisMonth: number;
    };
}