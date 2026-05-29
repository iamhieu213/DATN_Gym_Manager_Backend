import crypto from "crypto";
import "dotenv/config";

export class VnpayService {
    private readonly tmnCode = process.env.VNP_TMN_CODE ?? "2QXUIOJ1"; // Mã sandbox mặc định
    private readonly hashSecret = process.env.VNP_HASH_SECRET ?? "UZBJVYVUXVXXVYUZYUZYUZYUZYUZYUZY"; // Mã sandbox mặc định
    private readonly vnpUrl = process.env.VNP_URL ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    private readonly returnUrl = process.env.VNP_RETURN_URL ?? "http://localhost:3000/auth/vnpay-callback"; // URL Frontend nhận kết quả

    // 1. Tạo Link Thanh Toán VNPAY
    public createPaymentUrl(paymentId: number, amount: number, ipAddress: string, description: string): string {
        const date = new Date();
        const createDate = this.formatDate(date);

        const vnp_Params: any = {
            vnp_Version: "2.1.0",
            vnp_Command: "pay",
            vnp_TmnCode: this.tmnCode,
            vnp_Locale: "vn",
            vnp_CurrCode: "VND",
            vnp_TxnRef: paymentId.toString(),
            vnp_OrderInfo: description,
            vnp_OrderType: "other",
            vnp_Amount: Math.round(amount * 100).toString(), // VNPAY yêu cầu nhân 100 lần số tiền thực tế
            vnp_ReturnUrl: this.returnUrl,
            vnp_IpAddr: ipAddress || "127.0.0.1",
            vnp_CreateDate: createDate,
        };

        // Sắp xếp các tham số theo bảng chữ cái alphabet
        const sortedParams = this.sortObject(vnp_Params);

        // Tạo chuỗi ký tên (Sign Data)
        const signData = Object.keys(sortedParams)
            .map((key) => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`)
            .join("&");

        // Tạo mã hóa HMAC-SHA512 bằng HashSecret
        const hmac = crypto.createHmac("sha512", this.hashSecret);
        const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

        sortedParams["vnp_SecureHash"] = signed;

        // Trả về URL thanh toán đầy đủ kèm query string
        const queryParams = Object.keys(sortedParams)
            .map((key) => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`)
            .join("&");

        return `${this.vnpUrl}?${queryParams}`;
    }

    // 2. Xác thực phản hồi từ VNPAY (Kiểm tra chữ ký)
    public verifyResponse(vnp_Params: any): boolean {
        const secureHash = vnp_Params["vnp_SecureHash"];

        // Loại bỏ tham số chữ ký ra trước khi tính toán lại mã hash
        const paramsToSign = { ...vnp_Params };
        delete paramsToSign["vnp_SecureHash"];
        delete paramsToSign["vnp_SecureHashType"];

        const sortedParams = this.sortObject(paramsToSign);

        const signData = Object.keys(sortedParams)
            .map((key) => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`)
            .join("&");

        const hmac = crypto.createHmac("sha512", this.hashSecret);
        const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

        return secureHash === signed;
    }

    // Định dạng thời gian YYYYMMDDHHmmss
    private formatDate(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, "0");
        return (
            date.getFullYear() +
            pad(date.getMonth() + 1) +
            pad(date.getDate()) +
            pad(date.getHours()) +
            pad(date.getMinutes()) +
            pad(date.getSeconds())
        );
    }

    // Sắp xếp object theo thứ tự bảng chữ cái key
    private sortObject(obj: any) {
        const sorted: any = {};
        const keys = Object.keys(obj).sort();
        for (const key of keys) {
            sorted[key] = obj[key];
        }
        return sorted;
    }
}

export const vnpayService = new VnpayService();
