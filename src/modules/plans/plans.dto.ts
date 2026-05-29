export interface CreatePlanDto {
    name: string;
    description?: string;
    price: number;
    duration_days: number;
    features?: string[] | any; 
    is_active?: boolean;
}

export interface UpdatePlanDto {
    name?: string;
    description?: string;
    price?: number;
    duration_days?: number;
    features?: string[] | any;
    is_active?: boolean;
}

export interface ListPlanQueryDto {
    search?: string;
    limit?: string;
    page?: string;
    is_active?: string; // Nhận vào chuỗi "true" hoặc "false" từ query string
}