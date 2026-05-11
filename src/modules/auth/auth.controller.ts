import {  Request, Response } from 'express';
import { AuthService } from './auth.service';
import { prisma } from '../../config/client';
import { AuthRequest } from '../../middleware/auth.middleware';
import crypto from 'crypto';

const OAUTH_STATE_COOKIE = "oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 30 days

const authService = new AuthService(prisma);
const mapErrorStatus = (code:string) : number => {
    switch(code) {
        case "EMAIL_ALREADY_EXISTS":
            return 409;
        case "OTP_INVALID_OR_EXPIRED":
        case "INVALID_REGISTER_TOKEN":
        case "TOKEN_EMAIL_MISMATCH":
        case "REGISTER_TOKEN_EXPIRED":
            return 400;
        case "INVALID_CREDENTIALS":
            return 401;
        default:
            return 500;
    }
}

export const register = async (req: Request, res: Response) => {
    try {
        const result = await authService.register(req.body);
        res.status(201).json({
            email: result.email,
            registerToken: result.registerToken,
            message: "Ma OTP da duoc gui toi email cua ban, vui long kiem tra email va xac thuc"
        });
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code });
    }
}

export const verifyRegister = async (req: Request, res: Response) => {
    try {
        const result = await authService.verifyRegister(req.body);
        res.status(200).json({
            result,
            message: "Xac thuc thanh cong"
        });
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}

//Dang nhap
export const login = async (req: Request, res: Response) => {
    try{
        const result = await authService.login(req.body);
        res.status(200).json({result});
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}

//Api cap lai accressToken
export const refreshAccessToken = async (req: Request, res: Response) => {
    try {
        const result = await authService.refreshAccessToken(req.body.refreshToken);
        res.status(200).json({result});
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}

//Api dang xuat
export const logout = async (req: Request, res: Response) => {
    try {
        await authService.logout(req.body.refreshToken);
        res.status(200).json({ message: "Dang xuat thanh cong" });
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}

//Api doi mat khau
export const changePassword = async (req: AuthRequest, res: Response) => {
    try {
        if(!req.user?.userId) {
            throw new Error("UNAUTHORIZED");
        }
        await authService.ChangePassword(req.user.userId, req.body);
        res.status(200).json({ message: "Mat khau da duoc doi thanh cong" });
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}

//Api quen mat khau
//1.Gui ma Otp xac thuc
export const requestForgotPasswordOtp = async (req: Request, res: Response) => {
    try{
        await authService.requestForgotPasswordOtp(req.body.email);
        res.status(200).json({ message: "Ma OTP da duoc gui toi email cua ban, vui long kiem tra email va xac thuc" });
    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}
//2. Xac thuc ma Otp
export const verifyForgotPasswordOtp = async (req: Request, res: Response) => {
    try{
        const result = await authService.verifyForgotPasswordOtp(req.body);
        res.status(200).json({
            resetPasswordToken: result.resetPasswordToken,
            message: "Ma OTP da duoc xac thuc thanh cong, vui long dung token nay de thay doi mat khau"
        })

    }catch(error) {
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
    }
}
//3 Thay doi mat khau
export const resetPassword = async (req: Request, res: Response) => {
    try{
        await authService.resetPassword(req.body);
        res.status(200).json({ message: "Mat khau da duoc thay doi thanh cong" });
    }catch(error){
        const code = error instanceof Error ? error.message: "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({ error: code});
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