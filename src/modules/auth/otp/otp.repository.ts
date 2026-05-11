import { OtpType, PrismaClient } from "@prisma/client";

export class OtpRepository {
    constructor(private readonly prisma: PrismaClient) {}
    
    public async invalidateActiveOtpEmail(email: string, type: OtpType): Promise<void> {
        await this.prisma.otpVerification.updateMany({
            where: {
                email,
                type,
                isUsed: false,
            },
            data: {
                isUsed: true,
            }
        });
    }

    public async createOtp(email: string, otpCode: string, type: OtpType, expiresAt: Date) {
        return this.prisma.otpVerification.create({
            data: {
                email,
                otpCode,
                type,
                expiresAt,
                isUsed: false,
            },
        });
    }

    public async findValidOtp(email: string, otpCode: string, type: OtpType) {
        return this.prisma.otpVerification.findFirst({
            where: {
                email,
                type,
                otpCode,
                isUsed: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    public async markOtpUsed(otpId: string): Promise<void> {
        await this.prisma.otpVerification.update({
            where: { id: otpId },
            data: { isUsed: true },
        });
    }
}