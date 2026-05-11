export interface RegisterDto {
    email: string;
    password: string;
    name: string;
    phone: string;
    dateOfBirth: Date;
}

export interface RegisterResponseDto {
    email: string;
    registerToken: string;
}

export interface VerifyOtpDto {
    email: string;
    registerToken: string;
    otpCode: string;
}


export interface LoginDto {
    email: string;
    password: string;
}

export interface ChangePasswordDto {
    oldPassword: string;
    newPassword: string;
    confirmNewPassword: string;
}

export interface ForgotPasswordVerifyDto {
    email: string;
    otpCode: string;
}

export interface ResetPasswordDto {
    resetPasswordToken: string;
    newPassword: string;
    confirmNewPassword: string;
}