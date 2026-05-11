import nodemailer from "nodemailer";
import "dotenv/config";

const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? "465");
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
const MAIL_FROM = process.env.MAIL_FROM ?? SMTP_USER;

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
    if (!SMTP_USER || !SMTP_PASS) {
        throw new Error("SMTP_USER_AND_PASS_REQUIRED");
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });
    }
    return transporter;
}

export async function sendRegisterOtp(
    to: string,
    code: string,
    expiresInMinutes: number
): Promise<void> {
    if (!MAIL_FROM) {
        throw new Error("MAIL_FROM_OR_SMTP_USER_REQUIRED");
    }

    const transport = getTransporter();
    await transport.sendMail({
        from: MAIL_FROM,
        to,
        subject: "Mã xác thực đăng ký",
        text: `Mã OTP của bạn là: ${code}. Mã có hiệu lực trong ${expiresInMinutes} phút.`,
        html: `<p>Mã OTP của bạn là: <strong>${code}</strong>.</p><p>Mã có hiệu lực trong ${expiresInMinutes} phút.</p>`,
    });
}

export async function sendForgotPasswordOtp(
    to: string,
    code: string,
    expiresInMinutes: number
): Promise<void> {
    if (!MAIL_FROM) {
        throw new Error("MAIL_FROM_OR_SMTP_USER_REQUIRED");
    }

    const transport = getTransporter();
    await transport.sendMail({
        from: MAIL_FROM,
        to,
        subject: "Mã xác thực quên mật khẩu",
        text: `Mã OTP của bạn là: ${code}. Mã có hiệu lực trong ${expiresInMinutes} phút.`,
        html: `<p>Mã OTP của bạn là: <strong>${code}</strong>.</p><p>Mã có hiệu lực trong ${expiresInMinutes} phút.</p>`,
    });
}
