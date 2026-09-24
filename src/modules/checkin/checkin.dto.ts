export interface CheckInDto {
    phone: string;
}

export interface ListCheckInQueryDto {
    search? : string;
    page? : string;
    limit? : string;
}