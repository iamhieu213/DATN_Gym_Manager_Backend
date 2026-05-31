import { TrainingGoal } from '@prisma/client';

export interface CreatePtPackageDto {
    code: string;
    name: string;
    numberOfSessions: number;
    durationDays: number;
    goal: TrainingGoal;
    isActive?: boolean;
}

export interface UpdatePtPackageDto {
    code?: string;
    name?: string;
    numberOfSessions?: number;
    durationDays?: number;
    goal?: TrainingGoal;
    isActive?: boolean;
}

export interface SetCoachPackagePriceDto {
    coachId: number;
    ptPackageId: number;
    price: number;
}

export interface ListPackageCoachQueryDto {
    slots?: string; // Chuỗi JSON chứa mảng khung giờ: [{"dayOfWeek":1,"startTime":"18:00","endTime":"20:00"}]
    dayOfWeek?: string;
    startTime?: string;
    endTime?: string;
}

export interface ListPtPackageQueryDto {
    goal? : string,
    isActive? : string
}
