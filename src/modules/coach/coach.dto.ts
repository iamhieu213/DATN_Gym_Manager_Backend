export interface UpdateCoachProfileDto {
    speciality? : string;
    bio? : string;
    isAvailable? : boolean;
}

export interface RegisterAvailabilityDto {
    availabilities: {
        dayOfWeek: number;
        startTime : string;
        endTime: string;
    }[];
}

export interface ListCoachQueryDto {
    goal? : string;
    dayOfWeek? : string;
    startTime? : string;
    endTime? : string;
    search? : string;
    page? : string;
    limit? : string;
}