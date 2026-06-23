import 'dotenv/config';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { RegisterDto, RegisterResponseDto, VerifyOtpDto, LoginDto, ChangePasswordDto, ForgotPasswordVerifyDto, ResetPasswordDto } from './auth.dto';
import { sendRegisterOtp, sendForgotPasswordOtp } from '../../services/mail.service';
import bcrypt from 'bcrypt';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { buildGoogleAuthorizeUrl, exchangeCodeForUser } from '../../services/google-oauth.service';
import { redisService } from '../../services/redis.service';
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

    constructor(private readonly prisma: PrismaClient) {
        this.authRepository = new AuthRepository(prisma);
    }
    //Otp bat ki
    private generateOtpCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    //Tao token dang ky tai khoan co het han
    private signRegisterToken(payload: Omit<PendingRegisterPayload, "exp">): string {
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
        const [payloadB64, signature] = token.split(".");
        if (!payloadB64 || !signature) {
            throw new Error("INVALID_REGISTER_TOKEN");
        }

        const expectedSignature = crypto
            .createHmac("sha256", REGISTER_TOKEN_SECRET)
            .update(payloadB64)
            .digest("base64url");

        if (signature !== expectedSignature) {
            throw new Error("INVALID_REGISTER_TOKEN");
        }

        const payload = JSON.parse(
            Buffer.from(payloadB64, "base64url").toString("utf-8")
        ) as PendingRegisterPayload;

        if (payload.type !== "REGISTER_PENDING" || payload.exp < Date.now()) {
            throw new Error("REGISTER_TOKEN_EXPIRED");
        }

        return payload;

    }

    //Xoa toan bo refresh token cua user tren redis khi doi/reset mat khau
    private async revokeAllUserTokens(userId: number): Promise<void> {
        const client = redisService.getClient();
        const pattern = redisService.key("refresh_token", userId, "*");

        let cursor = '0';
        do {
            // Sử dụng SCAN thay cho KEYS để không chặn CPU của Redis trên môi trường Production
            const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await client.del(...keys);
            }
        } while (cursor !== '0');
    }

    public async register(dto: RegisterDto): Promise<RegisterResponseDto> {
        const email: string = dto.email.trim().toLowerCase();

        const existedUser = await this.authRepository.findUserByEmail(email);

        if (existedUser) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }

        const existedPhoneUser = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

        if (existedPhoneUser) {
            throw new Error("PHONE_ALREADY_EXISTS");
        }

        //Check Otp limit (toi da 3 lan gui otp trong vong 15 phut)
        const limitKey = redisService.key("otp:limit", "REGISTER", email);
        const requestCount = await redisService.get(limitKey);

        if (requestCount && Number(requestCount) >= 3) {
            throw new Error("OTP_LIMIT_EXCEEDED");
        }


        const passwordHash = await bcrypt.hash(dto.password, 10);
        const otpCode = this.generateOtpCode();

        const otpKey = redisService.key("otp:code", "REGISTER", email);
        await redisService.set(otpKey, otpCode, OTP_EXPIRES_IN_MINUTES * 60);

        await redisService.incrWithExpire(limitKey, 15 * 60);

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
    public async verifyRegister(dto: VerifyOtpDto): Promise<{ id: number, email: string }> {
        const email = dto.email.trim().toLowerCase();
        const payload = this.verifyRegisterToken(dto.registerToken);

        if (payload.email !== email) {
            throw new Error("TOKEN_EMAIL_MISMATCH");
        }

        // --- XÁC THỰC OTP TỪ REDIS ---
        const otpKey = redisService.key("otp:code", "REGISTER", email);
        const savedOtp = await redisService.get(otpKey);
        if (!savedOtp || savedOtp !== String(dto.otpCode).trim()) {
            throw new Error("OTP_INVALID_OR_EXPIRED");
        }

        return this.prisma.$transaction(async (tx) => {
            const txAuthRepository = new AuthRepository(tx as unknown as PrismaClient);

            const existedUser = await txAuthRepository.findUserByEmail(email);

            if (existedUser) {
                throw new Error("EMAIL_ALREADY_EXISTS");
            }

            const newUser = await txAuthRepository.createLocalUser({
                email: payload.email,
                passwordHash: payload.passwordHash,
                name: payload.name,
                phone: payload.phone,
                dateOfBirth: new Date(payload.dateOfBirth),
            });

            await redisService.del(otpKey);
            const limitKey = redisService.key("otp:limit", "REGISTER", email);
            await redisService.del(limitKey);

            return {
                id: newUser.id,
                email: newUser.email,
            };
        });
    }

    //Dang nhap
    public async login(dto: LoginDto): Promise<{ accessToken: string, refreshToken: string }> {
        const email = dto.email.trim().toLowerCase();
        // --- KIỂM TRA BLOCK TRẠNG THÁI DO NHẬP SAI QUÁ 5 LẦN ---
        const loginFailKey = redisService.key("login:attempts", email);
        const attempts = await redisService.get(loginFailKey);
        if (attempts && Number(attempts) >= 5) {
            throw new Error("LOGIN_LOCKED");
        }
        const user = await this.authRepository.findUserByEmail(email);
        if (!user || !user.passwordHash) {
            // Tăng đếm lỗi ngay cả khi không tồn tại user (tránh Brute-force quét email)
            await redisService.incrWithExpire(loginFailKey, 15 * 60);
            throw new Error("INVALID_CREDENTIALS");
        }
        const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isMatch) {
            await redisService.incrWithExpire(loginFailKey, 15 * 60);
            throw new Error("INVALID_CREDENTIALS");
        }
        // --- ĐĂNG NHẬP THÀNH CÔNG: RESET BỘ ĐẾM SAI MẬT KHẨU ---
        await redisService.del(loginFailKey);
        const accessToken = signAccessToken({
            userId: user.id,
            role: user.role,
            branchId: user.branchId,
        });
        const tokenId = crypto.randomUUID();
        const refreshToken = signRefreshToken({
            userId: user.id,
            tokenId,
        });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

        // --- LƯU REFRESH TOKEN VÀO REDIS (TTL 7 ngày = 604800s) ---
        const redisRefreshTokenKey = redisService.key("refresh_token", user.id, tokenId);
        await redisService.set(redisRefreshTokenKey, refreshTokenHash, 7 * 24 * 60 * 60);
        return {
            accessToken,
            refreshToken,
        };
    }

    //Api cap lai accessToken
    public async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
        const { userId, tokenId } = verifyRefreshToken(refreshToken);
        // --- TÌM REFRESH TOKEN TRÊN REDIS ---
        const redisRefreshTokenKey = redisService.key("refresh_token", userId, tokenId);
        const savedTokenHash = await redisService.get(redisRefreshTokenKey);
        if (!savedTokenHash) {
            throw new Error("INVALID_REFRESH_TOKEN");
        }
        const isTokenMatch = await bcrypt.compare(refreshToken, savedTokenHash);
        if (!isTokenMatch) {
            throw new Error("INVALID_REFRESH_TOKEN");
        }
        // Lấy thông tin role của User trực tiếp từ database
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, branchId : true },
        });
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const accessToken = signAccessToken({
            userId,
            role: user.role,
            branchId : user.branchId,
        });
        return { accessToken };
    }



    //Api dang xuat
    public async logout(refreshToken: string): Promise<void> {
        const { userId, tokenId } = verifyRefreshToken(refreshToken);
        const redisRefreshTokenKey = redisService.key("refresh_token", userId, tokenId);
        const savedTokenHash = await redisService.get(redisRefreshTokenKey);
        if (!savedTokenHash) {
            throw new Error("INVALID_REFRESH_TOKEN");
        }
        const isMatch = await bcrypt.compare(refreshToken, savedTokenHash);
        if (!isMatch) {
            throw new Error("INVALID_REFRESH_TOKEN");
        }
        // --- XÓA REFRESH TOKEN KHỎI REDIS ---
        await redisService.del(redisRefreshTokenKey);
    }

    //Api doi mat khau
    public async ChangePassword(userId: number, dto: ChangePasswordDto): Promise<void> {
        if (!dto.oldPassword || !dto.newPassword || !dto.confirmNewPassword) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }
        if (dto.newPassword !== dto.confirmNewPassword) {
            throw new Error("PASSWORD_MISMATCH");
        }
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, passwordHash: true },
        });
        if (!user || !user.passwordHash) {
            throw new Error("USER_NOT_FOUND");
        }

        const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
        if (!isMatch) {
            throw new Error("INVALID_OLD_PASSWORD");
        }

        const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash: newPasswordHash },
        });
        // --- HỦY TOÀN BỘ PHIÊN ĐĂNG NHẬP CỦA USER NÀY ---
        await this.revokeAllUserTokens(userId);
    }

    //Api quen mat khau
    //1. Gui email xac thuc
    public async requestForgotPasswordOtp(email: string): Promise<void> {
        const user = await this.authRepository.findUserByEmail(email);
        if (!user) return; // Bảo mật: Không báo lỗi nếu không tìm thấy email
        // --- CHECK OTP LIMIT (Tối đa 3 lần / 15 phút) ---
        const limitKey = redisService.key("otp:limit", "FORGOT_PASSWORD", email);
        const requestCount = await redisService.get(limitKey);
        if (requestCount && Number(requestCount) >= 3) {
            throw new Error("OTP_LIMIT_EXCEEDED");
        }
        const otpCode = this.generateOtpCode();
        // --- LƯU OTP VÀO REDIS (Mặc định 10 phút) ---
        const otpKey = redisService.key("otp:code", "FORGOT_PASSWORD", email);
        await redisService.set(otpKey, otpCode, OTP_EXPIRES_IN_MINUTES * 60);
        // --- TĂNG ĐẾM LƯỢT GỬI (Hạn 15 phút) ---
        await redisService.incrWithExpire(limitKey, 15 * 60);
        await sendForgotPasswordOtp(email, otpCode, OTP_EXPIRES_IN_MINUTES);
    }

    //2. Xac thuc ma Otp
    public async verifyForgotPasswordOtp(dto: ForgotPasswordVerifyDto): Promise<{ resetPasswordToken: string }> {
        const email = dto.email.trim().toLowerCase();
        // --- XÁC THỰC OTP TỪ REDIS ---
        const otpKey = redisService.key("otp:code", "FORGOT_PASSWORD", email);
        const savedOtp = await redisService.get(otpKey);
        if (!savedOtp || savedOtp !== String(dto.otpCode).trim()) {
            throw new Error("OTP_INVALID_OR_EXPIRED");
        }


        // Xác thực đúng -> Xóa OTP & Limit luôn
        await redisService.del(otpKey);
        const limitKey = redisService.key("otp:limit", "FORGOT_PASSWORD", email);
        await redisService.del(limitKey);
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
        if (!dto.resetPasswordToken || !dto.newPassword || !dto.confirmNewPassword) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }
        if (dto.newPassword !== dto.confirmNewPassword) {
            throw new Error("PASSWORD_MISMATCH");
        }
        let decoded: { email: string; purpose?: string };
        try {
            decoded = jwt.verify(dto.resetPasswordToken, process.env.RESET_PASSWORD_TOKEN_SECRET!) as { email: string; purpose: string };
        } catch (error) {
            throw new Error("INVALID_RESET_PASSWORD_TOKEN");
        }
        if (decoded.purpose !== "RESET_PASSWORD") {
            throw new Error("INVALID_RESET_PASSWORD_TOKEN");
        }
        const email = decoded.email.trim().toLowerCase();
        const user = await this.authRepository.findUserByEmail(email);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const newPasswordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash },
        });
        // --- HỦY TOÀN BỘ PHIÊN ĐĂNG NHẬP CŨ TRÊN REDIS ---
        await this.revokeAllUserTokens(user.id);
    }

    //Api dang nhap google
    private async issuseAuthTokensForUser(user: {
        id: number;
        role: import('@prisma/client').UserRole;
        branchId: number | null;
    }): Promise<{ accessToken: string, refreshToken: string }> {
        const accessToken = signAccessToken({ userId: user.id, role: user.role, branchId: user.branchId });
        const tokenId = crypto.randomUUID();
        const refreshToken = signRefreshToken({ userId: user.id, tokenId });
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        // --- LƯU REFRESH TOKEN VÀO REDIS (TTL 7 ngày) ---
        const redisRefreshTokenKey = redisService.key("refresh_token", user.id, tokenId);
        await redisService.set(redisRefreshTokenKey, refreshTokenHash, 7 * 24 * 60 * 60);
        return { accessToken, refreshToken };
    }

    public getGoogleAuthRedirectUrl(state: string): string {
        return buildGoogleAuthorizeUrl(state);
    }

    public async loginWithGoogleOAuthCode(code: string): Promise<{ accessToken: string, refreshToken: string }> {
        const g = await exchangeCodeForUser(code);

        let user = await this.authRepository.findUserByGoogleId(g.sub);
        if (user) {
            return this.issuseAuthTokensForUser(user);
        }

        const byEmail = await this.authRepository.findUserByEmail(g.email);
        if (byEmail) {
            if (byEmail.googleId && byEmail.googleId !== g.sub) {
                throw new Error("GOOGLE_ACCOUNT_CONFLICT");
            }
            if (!byEmail.googleId) {
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