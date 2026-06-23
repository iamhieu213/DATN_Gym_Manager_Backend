export interface CreateBranchDto {
    name: string;
    code: string;
    address: string;
    phone?: string;
    isActive?: boolean;
}

export interface UpdateBranchDto {
    name?: string;
    code?: string;
    address?: string;
    phone?: string;
    isActive?: boolean;
}

export interface ListBranchQueryDto {
    search?: string;
    isActive?: string;
    page?: string;
    limit?: string;
}