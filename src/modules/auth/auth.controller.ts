import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { prisma } from '../../config/client';
import { AuthRequest } from '../../middleware/auth.middleware';
import crypto from 'crypto';

const OAUTH_STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 30 days

const authService = new AuthService(prisma);
const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "EMAIL_ALREADY_EXISTS":
            return 409;
        case "OTP_INVALID_OR_EXPIRED":
        case "INVALID_REGISTER_TOKEN":
        case "TOKEN_EMAIL_MISMATCH":
        case "REGISTER_TOKEN_EXPIRED":
        case "PASSWORD_MISMATCH":
        case "MISSING_REQUIRED_FIELDS":
            return 400;
        case "INVALID_CREDENTIALS":
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "USER_NOT_FOUND":
            return 404;
        case "LOGIN_LOCKED":
        case "OTP_LIMIT_EXCEEDED":
            return 429;
        default:
            return 500;
    }
}

const mapErrorMessage = (code: string): string => {
    switch (code) {
        case "EMAIL_ALREADY_EXISTS":
            return "Email này đã được sử dụng bởi một tài khoản khác.";
        case "OTP_INVALID_OR_EXPIRED":
            return "Mã OTP không chính xác hoặc đã hết hạn.";
        case "INVALID_REGISTER_TOKEN":
            return "Token đăng ký không hợp lệ.";
        case "TOKEN_EMAIL_MISMATCH":
            return "Token đăng ký không khớp với email cung cấp.";
        case "REGISTER_TOKEN_EXPIRED":
            return "Token đăng ký đã hết hạn.";
        case "INVALID_CREDENTIALS":
            return "Email hoặc mật khẩu không chính xác.";
        case "UNAUTHORIZED":
            return "Bạn chưa đăng nhập hoặc token đã hết hạn.";
        case "FORBIDDEN":
            return "Bạn không có quyền thực hiện thao tác này.";
        case "USER_NOT_FOUND":
            return "Không tìm thấy người dùng này trong hệ thống.";
        case "PASSWORD_MISMATCH":
            return "Mật khẩu mới và xác nhận mật khẩu không khớp nhau.";
        case "INVALID_OLD_PASSWORD":
            return "Mật khẩu cũ không chính xác.";
        case "MISSING_REQUIRED_FIELDS":
            return "Vui lòng điền đầy đủ các thông tin bắt buộc.";
        case "BAD_REQUEST":
            return "Yêu cầu không hợp lệ.";
        case "LOGIN_LOCKED":
            return "Tài khoản của bạn đã bị khóa tạm thời trong 15 phút do nhập sai mật khẩu quá 5 lần.";
        case "OTP_LIMIT_EXCEEDED":
            return "Bạn đã yêu cầu gửi mã OTP quá giới hạn (tối đa 3 lần trong 15 phút). Vui lòng thử lại sau.";
        default:
            return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    }
};

export const register = async (req: Request, res: Response) => {
    try {
        const result = await authService.register(req.body);
        res.status(201).json({
            success: true,
            message: "Mã OTP đã được gửi tới email của bạn, vui lòng kiểm tra email và xác thực.",
            data: {
                email: result.email,
                registerToken: result.registerToken
            }
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

export const verifyRegister = async (req: Request, res: Response) => {
    try {
        const result = await authService.verifyRegister(req.body);
        res.status(200).json({
            success: true,
            message: "Xác thực đăng ký tài khoản thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

//Dang nhap
export const login = async (req: Request, res: Response) => {
    try {
        const result = await authService.login(req.body);
        res.status(200).json({
            success: true,
            message: "Đăng nhập thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

//Api cap lai accressToken
export const refreshAccessToken = async (req: Request, res: Response) => {
    try {
        const result = await authService.refreshAccessToken(req.body.refreshToken);
        res.status(200).json({
            success: true,
            message: "Làm mới access token thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

//Api dang xuat
export const logout = async (req: Request, res: Response) => {
    try {
        await authService.logout(req.body.refreshToken);
        res.status(200).json({
            success: true,
            message: "Đăng xuất thành công.",
            data: null
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

//Api doi mat khau
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.userId) {
            throw new Error("UNAUTHORIZED");
        }
        await authService.ChangePassword(req.user.userId, req.body);
        res.status(200).json({
            success: true,
            message: "Đổi mật khẩu thành công.",
            data: null
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

//Api quen mat khau
//1.Gui ma Otp xac thuc
export const requestForgotPasswordOtp = async (req: Request, res: Response) => {
    try {
        await authService.requestForgotPasswordOtp(req.body.email);
        res.status(200).json({
            success: true,
            message: "Mã OTP đã được gửi tới email của bạn, vui lòng kiểm tra email và xác thực.",
            data: null
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}
//2. Xac thuc ma Otp
export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
    try {
        const result = await authService.verifyForgotPasswordOtp(req.body);
        res.status(200).json({
            success: true,
            message: "Xác thực mã OTP thành công. Vui lòng dùng token này để thay đổi mật khẩu.",
            data: {
                resetPasswordToken: result.resetPasswordToken
            }
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}
//3 Thay doi mat khau
export const resetPassword = async (req: Request, res: Response) => {
    try {
        await authService.resetPassword(req.body);
        res.status(200).json({
            success: true,
            message: "Mật khẩu đã được thay đổi thành công.",
            data: null
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

function getOAuthErrorRedirectUrl(): string | null {
    const url = process.env.FRONTEND_OAUTH_ERROR_URL?.trim();
    return url || null;
}

function getOAuthSuccessRedirectUrl(): string | null {
    const url = process.env.FRONTEND_OAUTH_SUCCESS_URL?.trim();
    return url || null;
}

export const googleAuthStart = (req: Request, res: Response) => {
    try {
        const state = crypto.randomBytes(32).toString("hex");
        res.cookie(OAUTH_STATE_COOKIE, state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: STATE_MAX_AGE_MS,
        });
        const url = authService.getGoogleAuthRedirectUrl(state);
        res.redirect(url);
    } catch {
        const errUrl = getOAuthErrorRedirectUrl();
        if (!errUrl) {
            return res.status(500).send("FRONTEND_OAUTH_ERROR_URL is not set (and Google OAuth config failed). Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL.");
        }
        res.redirect(`${errUrl}?reason=config`);
    }
};

export const googleAuthCallback = async (req: Request, res: Response) => {
    const errUrl = getOAuthErrorRedirectUrl();
    const okUrl = getOAuthSuccessRedirectUrl();
    if (!errUrl || !okUrl) {
        return res.status(500).send("Set FRONTEND_OAUTH_SUCCESS_URL and FRONTEND_OAUTH_ERROR_URL in .env (full URLs, e.g. http://localhost:3000/oauth/success).");
    }
    try {
        const code = req.query.code as string | undefined;
        const state = req.query.state as string | undefined;
        const cookieState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
        if (!code || !state || !cookieState || state !== cookieState) {
            res.clearCookie(OAUTH_STATE_COOKIE);
            return res.redirect(`${errUrl}?reason=state`);
        }
        res.clearCookie(OAUTH_STATE_COOKIE);
        const result = await authService.loginWithGoogleOAuthCode(code);
        const q = new URLSearchParams({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
        return res.redirect(`${okUrl}?${q.toString()}`);
    } catch {
        return res.redirect(`${errUrl}?reason=google`);
    }
};