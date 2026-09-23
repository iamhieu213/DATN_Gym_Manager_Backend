// DTO khi đặt lịch tập mới
export interface BookSessionDto {
  coachId: number;
  scheduledAt: string; 
  note?: string;
}

// DTO khi PT hoặc Admin cập nhật trạng thái buổi tập
export interface UpdateSessionStatusDto {
  status: 'PLANNED' | 'COMPLETED' | 'SKIPPED';
}