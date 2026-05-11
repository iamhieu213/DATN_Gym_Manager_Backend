import 'dotenv/config';
import crypto from 'crypto';
import { OtpType, PrismaClient } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { RegisterDto, RegisterResponseDto, VerifyOtpDto, LoginDto, ChangePasswordDto, ForgotPasswordVerifyDto, ResetPasswordDto } from './auth.dto';
import { OtpRepository } from './otp/otp.repository';
import { sendRegisterOtp, sendForgotPasswordOtp } from '../../services/mail.service';
import bcrypt from 'bcrypt';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { buildGoogleAuthorizeUrl, exchangeCodeForUser } from '../../services/google-oauth.service';
import jwt from 'jsonwebtoken';
interface PendingRegisterPayload {
    email: string;
    passwordHash: string;
    name: string;
    phone: string;
    dateOfBirth: string;
    type: "REGISTER_PENDING";
    exp: number;
}

const PASSWORD_KEYLEN = 64;
const OTP_EXPIRES_IN_MINUTES = 10;
const REGISTER_TOKEN_EXPIRES_IN_MINUTES = 15;
const REGISTER_TOKEN_SECRET = process.env.REGISTER_TOKEN_SECRET!;

export class AuthService {
    private readonly authRepository: AuthRepository;
    private readonly otpRepository: OtpRepository;

    constructor(private readonly prisma: PrismaClient) {
        this.authRepository = new AuthRepository(prisma);
        this.otpRepository = new OtpRepository(prisma);
    }
    //Otp bat ki
    private generateOtpCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    //Tao token dang ky tai khoan co het han
    private  signRegisterToken(payload: Omit<PendingRegisterPayload, "exp">): string {
        const fullPayload: PendingRegisterPayload = {
            ...payload,
            exp: Date.now() + REGISTER_TOKEN_EXPIRES_IN_MINUTES * 60 * 1000,
        };

        const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
        const signature = crypto
            .createHmac("sha256", REGISTER_TOKEN_SECRET)
            .update(payloadB64)
            .digest("base64url");

            return `${payloadB64}.${signature}`;
    }

    //xac thuc token
    private verifyRegisterToken(token: string): PendingRegisterPayload {
        const [ payloadB64, signature ] = token.split(".");
        if(!payloadB64 || !signature) {
            throw new Error("INVALID_REGISTER_TOKEN");
        }

        const expectedSignature = crypto
           .createHmac("sha256", REGISTER_TOKEN_SECRET)
           .update(payloadB64)
           .digest("base64url");

        if(signature !== expectedSignature) {
            throw new Error("INVALID_REGISTER_TOKEN");
        }

        const payload = JSON.parse(
            Buffer.from(payloadB64, "base64url").toString("utf-8")
        ) as PendingRegisterPayload;
        
        if(payload.type !== "REGISTER_PENDING" || payload.exp < Date.now()) {
            throw new Error("REGISTER_TOKEN_EXPIRED");
        }

        return payload;
        
    }

    public async register(dto: RegisterDto): Promise<RegisterResponseDto> {
        const email : string = dto.email.trim().toLowerCase();

        const existedUser = await this.authRepository.findUserByEmail(email);

        if(existedUser) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }

        const passwordHash = await bcrypt.hash(dto.password , 10);
        const otpCode = this.generateOtpCode();
        const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);
        
        await this.otpRepository.invalidateActiveOtpEmail(email, OtpType.REGISTER);
        await this.otpRepository.createOtp(email, otpCode, OtpType.REGISTER, expiresAt);
        
        await sendRegisterOtp(email, otpCode, OTP_EXPIRES_IN_MINUTES);
        const parsedDateOfBirth = new Date(dto.dateOfBirth);
        const registerToken = this.signRegisterToken({
            email,
            passwordHash,
            name: dto.name,
            phone: dto.phone,
            dateOfBirth: parsedDateOfBirth.toISOString(),
            type: "REGISTER_PENDING",
        });

        return { 
            email,
            registerToken,
            
        };
    }

    //Xac thuc dang ky
    public async verifyRegister(dto: VerifyOtpDto): Promise<{ id : string, email: string }>{
          const email = dto.email.trim().toLowerCase();
          const payload = this.verifyRegisterToken(dto.registerToken);

          if(payload.email !== email) {
            throw new Error("TOKEN_EMAIL_MISMATCH");
          }

          const otpRecord = await this.otpRepository.findValidOtp(email, dto.otpCode, OtpType.REGISTER);

          if(!otpRecord) {
            throw new Error("OTP_INVALID_OR_EXPIRED");
          }

          return this.prisma.$transaction(async (tx) => {
             const txAuthRepository = new AuthRepository(tx as unknown as PrismaClient);
             const txOtpRepository = new OtpRepository(tx as unknown as PrismaClient);

             const existedUser = await txAuthRepository.findUserByEmail(email);

             if(existedUser) {
                throw new Error("EMAIL_ALREADY_EXISTS");
             }

             const newUser = await txAuthRepository.createLocalUser({
                email: payload.email,
                passwordHash: payload.passwordHash,
                name: payload.name,
                phone: payload.phone,
                dateOfBirth: new Date(payload.dateOfBirth),
             });

             await txOtpRepository.markOtpUsed(otpRecord.id);

             return {
                id: newUser.id,
                email: newUser.email,
             };
          });
    }

    //Dang nhap
    public async login(dto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
        const email = dto.email.trim().toLowerCase();
        const user = await this.authRepository.findUserByEmail(email);

        if(!user || !user.passwordHash) {
            throw new Error("INVALID_CREDENTIALS");
        }

        const isMatch = await bcrypt.compare(dto.password, user.passwordHash);

        if(!isMatch) {
            throw new Error("INVALID_CREDENTIALS");
        }
        
        const accessToken = signAccessToken({
            userId: user.id,
            role: user.role,
        });
        
        const tokenId = crypto.randomUUID();
        const refreshToken = signRefreshToken({
            userId: user.id,
            tokenId,
        });
        
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
        
        await this.prisma.$transaction(async (tx) => {
            await tx.refreshToken.updateMany({
                where: { userId: user.id, isRevoked: false },
                data: { isRevoked: true },
            });
           
            await tx.refreshToken.create({
                data: {
                    userId: user.id,
                    tokenId,
                    token: refreshTokenHash,
                    expiresAt: refreshExpiresAt,
                    isRevoked: false,
                }
            })
        })
        return {
            accessToken,
            refreshToken,
        };   
    }

    //Api cap lai accressToken
    public async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
        const { userId, tokenId } = verifyRefreshToken(refreshToken);

        const savedRefreshToken = await this.prisma.refreshToken.findFirst({
            where: {
                userId,
                tokenId,
                isRevoked: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
            include: {
                user: {
                    select: {
                        role: true,
                    },
                },
            },
        });

        if (!savedRefreshToken) {
            throw new Error("INVALID_REFRESH_TOKEN");
        }

        const isTokenMatch = await bcrypt.compare(refreshToken, savedRefreshToken.token);
        if (!isTokenMatch) {
            throw new Error("INVALID_REFRESH_TOKEN");
        }

        const accessToken = signAccessToken({
            userId,
            role: savedRefreshToken.user.role,
        });

        return { accessToken };
    }
    

    //Api dang xuat
    public async logout(refreshToken: string): Promise<void> {
         const { userId, tokenId } = verifyRefreshToken(refreshToken);
         const savedRefreshToken = await this.prisma.refreshToken.findFirst({
            where: {
                userId,
                tokenId,
                isRevoked: false,
            },
         });

         if(!savedRefreshToken) {
            throw new Error("INVALID_REFRESH_TOKEN");
         }

         const isMatch = await bcrypt.compare(refreshToken, savedRefreshToken.token);
         if(!isMatch) {
            throw new Error("INVALID_REFRESH_TOKEN");
         }

         await this.prisma.refreshToken.update({
            where: { id: savedRefreshToken.id },
            data: { isRevoked: true },
         });
    }

    //Api doi mat khau
    public async ChangePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
        if(!dto.oldPassword || !dto.newPassword || !dto.confirmNewPassword) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }

        if(dto.newPassword !== dto.confirmNewPassword) {
            throw new Error("PASSWORD_MISMATCH");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true },
        });

        if(!user || !user.passwordHash) {
            throw new Error("USER_NOT_FOUND");
        }
        const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
        if(!isMatch) {
            throw new Error("INVALID_OLD_PASSWORD");
        }
        const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id : userId },
                data: { passwordHash: newPasswordHash },
            });

            await tx.refreshToken.updateMany({
                where: { userId, isRevoked: false },
                data: { isRevoked: true },
            })
        })
    }

    //Api quen mat khau
    //1. Gui email xac thuc
    public async requestForgotPasswordOtp(email: string) : Promise<void> {
        const user = await this.authRepository.findUserByEmail(email);
        if(!user) return;

        const otpCode = this.generateOtpCode();

        const expiresAt = new Date(Date.now() + OTP_EXPIRES_IN_MINUTES * 60 * 1000);

        await this.otpRepository.invalidateActiveOtpEmail(email, OtpType.FORGOT_PASSWORD);
        await this.otpRepository.createOtp(email, otpCode, OtpType.FORGOT_PASSWORD, expiresAt);

        await sendForgotPasswordOtp(email, otpCode, OTP_EXPIRES_IN_MINUTES);
    }
    //2. Xac thuc ma Otp
    public async verifyForgotPasswordOtp(dto: ForgotPasswordVerifyDto): Promise<{ resetPasswordToken: string }> {
        const email = dto.email.trim().toLowerCase();

        const otpRecord = await this.otpRepository.findValidOtp(
            email,
            dto.otpCode,
            OtpType.FORGOT_PASSWORD,
        );

        if (!otpRecord) {
            throw new Error("OTP_INVALID_OR_EXPIRED");
        }
        
        await this.prisma.otpVerification.update({
            where: { id: otpRecord.id },
            data: { isUsed: true}
        });

        const resetPasswordToken = jwt.sign(
             {
                email,
                purpose: "RESET_PASSWORD",
             },
             process.env.RESET_PASSWORD_TOKEN_SECRET!,
             { expiresIn: "5m" }
        );

        return { resetPasswordToken };
    }
    //3. Thay doi mat khau
    public async resetPassword(dto: ResetPasswordDto): Promise<void> {
        if(!dto.resetPasswordToken || !dto.newPassword || !dto.confirmNewPassword) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }

        if(dto.newPassword !== dto.confirmNewPassword) {
            throw new Error("PASSWORD_MISMATCH");
        }

        let decoded: { email : string; purpose?: string };
        try {
            decoded = jwt.verify(dto.resetPasswordToken, process.env.RESET_PASSWORD_TOKEN_SECRET!) as { email : string; purpose: string };
        }catch(error){
            throw new Error("INVALID_RESET_PASSWORD_TOKEN");
        }

        if(decoded.purpose !== "RESET_PASSWORD") {
            throw new Error("INVALID_RESET_PASSWORD_TOKEN");
        }
        const email = decoded.email.trim().toLowerCase();

        const user = await this.authRepository.findUserByEmail(email);
        if(!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: { passwordHash: newPasswordHash },
            });
            await tx.refreshToken.updateMany({
                where: { userId: user.id, isRevoked: false },
                data: { isRevoked: true },
            })
        })

    }

    //Api dang nhap google
    private async issuseAuthTokensForUser(user: {
        id: string;
        role: import('@prisma/client').UserRole;
    }): Promise<{ accessToken: string, refreshToken: string }> {
        const accessToken = signAccessToken({ userId: user.id, role: user.role });
        const tokenId = crypto.randomUUID();
        const refreshToken = signRefreshToken({ userId: user.id, tokenId });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
            await tx.refreshToken.updateMany({
                where: { userId: user.id, isRevoked: false },
                data: { isRevoked: true },
            });

            await tx.refreshToken.create({
                data: {
                    userId: user.id,
                    tokenId,
                    token: refreshTokenHash,
                    expiresAt: refreshExpiresAt,
                    isRevoked: false,
                }
            })
        });

        return { accessToken, refreshToken };
    }

    public getGoogleAuthRedirectUrl(state: string): string {
        return buildGoogleAuthorizeUrl(state);
    }

    public async loginWithGoogleOAuthCode(code: string): Promise<{ accessToken: string, refreshToken: string }> {
        const g = await exchangeCodeForUser(code);

        let user = await this.authRepository.findUserByGoogleId(g.sub);
        if(user) {
            return this.issuseAuthTokensForUser(user);
        }

        const byEmail = await this.authRepository.findUserByEmail(g.email);
        if(byEmail) {
            if(byEmail.googleId && byEmail.googleId !== g.sub){
                throw new Error("GOOGLE_ACCOUNT_CONFLICT");
            }
            if(!byEmail.googleId) {
                user = await this.authRepository.linkGoogleAccount(byEmail.id, g.sub);
            } else {
                user = byEmail;
            }

            return this.issuseAuthTokensForUser(user);
        }

        user = await this.authRepository.createGoogleOnlyUser({
            email: g.email,
            googleId: g.sub,
            name: g.name,
        });

        return this.issuseAuthTokensForUser(user);
    }
}