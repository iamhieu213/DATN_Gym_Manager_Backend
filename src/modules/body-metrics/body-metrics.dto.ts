export interface CreateBodyMetricsDto {
    weight_kg: number;
    height_cm: number;
    body_fat_pct?: number;
    muscle_mass_kg?: number;
    water_pct?: number;
    note?: string;
    recorded_at?: string; // Định dạng "YYYY-MM-DD"
}

export interface UpdateBodyMetricsDto {
    weight_kg?: number;
    height_cm?: number;
    body_fat_pct?: number;
    muscle_mass_kg?: number;
    water_pct?: number;
    note?: string;
    recorded_at?: string; // Định dạng "YYYY-MM-DD"
}

export interface ListBodyMetricQueryDto {
    page?: string;
    limit?: string;
    startDate?: string;
    endDate?: string;
    userId?: string; // ID của hội viên cần xem (dành cho Admin/PT)
}