export interface CheckInDto {
    phone: string;
    branchId? : number;
}

export interface ListCheckInQueryDto {
    search? : string;
    page? : string;
    limit? : string;
    branchId? : string;
}