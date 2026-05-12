import { UserRole, UserStatus } from "@prisma/client";

export interface ListUserQueryDto {
    page?: string;
    limit?: string;
    search? : string;
    role? : UserRole;
    status? : UserStatus;
}

export interface UserListItemDto {
    id: string;
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