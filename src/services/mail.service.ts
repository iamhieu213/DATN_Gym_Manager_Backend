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

export const sendWelcomeStaffMail = async (
    email: string, 
    name: string, 
    role: string, 
    temporaryPassword: string
): Promise<void> => {
    if (!MAIL_FROM) {
        throw new Error("MAIL_FROM_OR_SMTP_USER_REQUIRED");
    }
    const loginUrl = process.env.FRONTEND_LOGIN_URL || "http://localhost:3000/login";
    
    const subject = "[Gym Manager] Chào mừng thành viên mới - Thông tin tài khoản";
    const html = `
        <h3>Chào mừng ${name} đến với đội ngũ nhân viên phòng GYM!</h3>
        <p>Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống với vai trò: <strong>${role}</strong>.</p>
        <p>Dưới đây là thông tin đăng nhập của bạn:</p>
        <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Mật khẩu tạm thời:</strong> ${temporaryPassword}</li>
        </ul>
        <p>Vui lòng truy cập đường link dưới đây để đăng nhập:</p>
        <p><a href="${loginUrl}" target="_blank">Đăng nhập vào hệ thống</a></p>
        <p style="color: red;"><strong>Lưu ý:</strong> Vì lý do an toàn bảo mật, bạn hãy thực hiện thay đổi mật khẩu ngay sau lần đăng nhập đầu tiên.</p>
        <br/>
        <p>Trân trọng,</p>
        <p>Ban Quản Trị Phòng GYM</p>
    `;
    const transport = getTransporter();
    await transport.sendMail({
        from: MAIL_FROM,
        to: email,
        subject,
        html,
    });
};
