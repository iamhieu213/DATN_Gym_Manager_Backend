import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { MembershipsService } from "./membership.service";
import { MembershipRepository } from "./membership.repository";
import { prisma } from "../../config/client";
import { BuyMembershipDto, UpgradeMembershipDto, ListMembershipQueryDto } from "./membership.dto";
import { vnpayService } from "../../services/vnpay.service";

const repository = new MembershipRepository(prisma);
const membershipsService = new MembershipsService(repository);

const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "PLAN_NOT_FOUND":
        case "PAYMENT_NOT_FOUND":
        case "MEMBERSHIP_NOT_FOUND":
            return 404;
        case "ALREADY_HAVE_ACTIVE_PLAN":
        case "NO_ACTIVE_PLAN_TO_UPGRADE":
        case "CANNOT_DOWNGRADE_OR_EQUAL":
        case "PAYMENT_ALREADY_PROCESSED":
        case "MEMBERSHIP_NOT_ACTIVE":
        case "BAD_REQUEST":
            return 400;
        default:
            return 500;
    }
};

const mapErrorMessage = (code: string): string => {
    switch (code) {
        case "UNAUTHORIZED":
            return "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.";
        case "FORBIDDEN":
            return "Bạn không có quyền thực hiện chức năng này.";
        case "PLAN_NOT_FOUND":
            return "Gói tập không hợp lệ hoặc đã ngừng hoạt động.";
        case "PAYMENT_NOT_FOUND":
            return "Không tìm thấy thông tin hóa đơn.";
        case "MEMBERSHIP_NOT_FOUND":
            return "Không tìm thấy đăng ký gói tập.";
        case "ALREADY_HAVE_ACTIVE_PLAN":
            return "Bạn đã có gói tập đang hoạt động. Vui lòng chọn nâng cấp gói nếu muốn thay đổi.";
        case "NO_ACTIVE_PLAN_TO_UPGRADE":
            return "Không tìm thấy gói tập đang hoạt động nào để thực hiện nâng cấp.";
        case "CANNOT_DOWNGRADE_OR_EQUAL":
            return "Chỉ được nâng cấp lên các gói tập có giá trị lớn hơn gói hiện tại.";
        case "PAYMENT_ALREADY_PROCESSED":
            return "Hóa đơn này đã hoàn tất thanh toán.";
        case "MEMBERSHIP_NOT_ACTIVE":
            return "Gói tập này hiện không ở trạng thái kích hoạt.";
        default:
            return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    }
};

export const handleVnpayIpn = async (req: Request, res: Response) => {
    try {
        const vnp_Params = req.query;
        // 1. Kiểm tra tính hợp lệ của chữ ký từ VNPAY gửi sang
        const isValidSignature = vnpayService.verifyResponse({ ...vnp_Params });
        if (!isValidSignature) {
            // Theo chuẩn VNPAY: Chữ ký không khớp trả về RspCode 97
            return res.status(200).json({ RspCode: "97", Message: "Invalid Signature" });
        }
        const paymentId = parseInt(vnp_Params["vnp_TxnRef"] as string, 10);
        const amount = parseFloat(vnp_Params["vnp_Amount"] as string) / 100; // VNPAY gửi số tiền đã nhân 100, ta chia lại 100
        const responseCode = vnp_Params["vnp_ResponseCode"] as string;
        const transactionNo = vnp_Params["vnp_TransactionNo"] as string;
        // 2. Tìm hóa đơn trong Database
        const payment = await prisma.payment.findUnique({
            where: { id: paymentId }
        });
        if (!payment) {
            return res.status(200).json({ RspCode: "01", Message: "Order not found" });
        }
        // 3. Kiểm tra số tiền thanh toán có khớp với hóa đơn gốc không
        if (Number(payment.amount) !== amount) {
            return res.status(200).json({ RspCode: "04", Message: "Invalid Amount" });
        }
        // 4. Kiểm tra trạng thái hóa đơn (chỉ xử lý nếu hóa đơn vẫn đang ở trạng thái PENDING)
        if (payment.status !== "PENDING") {
            return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
        }
        // 5. Cập nhật kết quả giao dịch vào Database
        if (responseCode === "00") {
            // Giao dịch thành công -> Kích hoạt gói tập (Truyền quyền 'ADMIN' để duyệt)
            await membershipsService.confirmPayment("ADMIN", paymentId, transactionNo, vnp_Params);
            
            return res.status(200).json({ RspCode: "00", Message: "Confirm success" });
        } else {
            // Giao dịch thất bại
            await prisma.$transaction(async (tx) => {
                await tx.payment.update({
                    where: { id: paymentId },
                    data: { status: "FAILED", gateway_response: vnp_Params }
                });
                await tx.membership.update({
                    where: { id: payment.membership_id },
                    data: { status: "CANCELLED" }
                });
            });
            
            return res.status(200).json({ RspCode: "00", Message: "Confirm success (Failed Payment)" });
        }
    } catch (error) {
        console.error("VNPAY IPN Error:", error);
        // Trả về lỗi hệ thống
        return res.status(200).json({ RspCode: "99", Message: "System Error" });
    }
};

export const buyMembership = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.buyMembership(userId, req.body as BuyMembershipDto);

        let paymentUrl: string | null = null;

        if (req.body.paymentMethod === "VNPAY") {
            const clientIp = req.ip || "127.0.0.1";
            paymentUrl = vnpayService.createPaymentUrl(
                result.paymentId,
                Number(result.amount),
                clientIp,
                `Thanh toan goi tap: ID ${result.membershipId}`
            );
        }
 
        res.status(201).json({
            success: true,
            message: "Đăng ký mua gói tập thành công. Vui lòng thanh toán hóa đơn.",
            data: {
                ...result,
                paymentUrl
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
};

export const upgradeMembership = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.upgradeMembership(userId, req.body as UpgradeMembershipDto);

        let paymentUrl: string | null = null;

        if (req.body.paymentMethod === "VNPAY") {
            const clientIp = req.ip || "127.0.0.1";
            paymentUrl = vnpayService.createPaymentUrl(
                result.paymentId,
                Number(result.amount),
                clientIp,
                `Nang cap goi tap: ID ${result.membershipId}`
            );
        }

        res.status(200).json({
            success: true,
            message: "Tạo yêu cầu nâng cấp thành công. Vui lòng thanh toán số tiền chênh lệch.",
            data: {
                ...result,
                paymentUrl
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
};

export const confirmPayment = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("UNAUTHORIZED");

        if (!req.params.paymentId || Array.isArray(req.params.paymentId)) {
            return res.status(400).json({
                success: false,
                message: "ID hóa đơn thanh toán không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const paymentId = parseInt(req.params.paymentId, 10);
        if (isNaN(paymentId)) {
            return res.status(400).json({
                success: false,
                message: "ID hóa đơn thanh toán không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }

        const result = await membershipsService.confirmPayment(role, paymentId);
        res.status(200).json({
            success: true,
            message: "Xác nhận đóng tiền và kích hoạt gói tập thành công.",
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
};

export const cancelMembership = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("UNAUTHORIZED");

        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói đăng ký không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID gói đăng ký không hợp lệ.",
                error: "BAD_REQUEST"
            });
        }

        const result = await membershipsService.cancelMembership(role, id);
        res.status(200).json({
            success: true,
            message: "Hủy gói tập của hội viên thành công.",
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
};

export const getActiveMembership = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.getActiveMembership(userId);
        res.status(200).json({
            success: true,
            message: "Lấy thông tin gói tập hiện tại thành công.",
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
};

export const getMyHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        if (!userId) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.getMyHistory(userId);
        res.status(200).json({
            success: true,
            message: "Lấy lịch sử mua gói tập thành công.",
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
};

export const getAllMemberships = async (req: AuthRequest, res: Response) => {
    try {
        const role = req.user?.role;
        if (!role) throw new Error("UNAUTHORIZED");

        const result = await membershipsService.getAllMemberships(role, req.query as ListMembershipQueryDto);
        res.status(200).json({
            success: true,
            message: "Lấy danh sách đăng ký gói tập thành công.",
            data: result.data,
            meta: result.meta
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// API hiển thị kết quả trực quan trên trình duyệt khi test (Không cần Frontend)
export const handleVnpayReturn = async (req: Request, res: Response) => {
    try {
        const vnp_Params = req.query;

        // 1. Xác thực chữ ký phản hồi từ VNPAY
        const isValidSignature = vnpayService.verifyResponse({ ...vnp_Params });
        if (!isValidSignature) {
            return res.send("<h1>Lỗi: Chữ ký không hợp lệ!</h1>");
        }

        const responseCode = vnp_Params["vnp_ResponseCode"] as string;
        const paymentId = parseInt(vnp_Params["vnp_TxnRef"] as string, 10);
        const transactionNo = vnp_Params["vnp_TransactionNo"] as string;

        if (responseCode === "00") {
            // 🔍 --- CẬP NHẬT DATABASE NGAY TẠI ĐÂY KHI CHẠY LOCAL ---
            const payment = await prisma.payment.findUnique({
                where: { id: paymentId }
            });

            // Chỉ cập nhật nếu hóa đơn vẫn đang ở trạng thái PENDING (tránh trùng lặp)
            if (payment && payment.status === "PENDING") {
                await membershipsService.confirmPayment("ADMIN", paymentId, transactionNo, vnp_Params);
                console.log(`[VNPAY Return] Đã kích hoạt thành công đơn hàng ID: ${paymentId}`);
            }

            return res.send(`
                <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                    <h1 style="color: green;">🎉 THANH TOÁN THÀNH CÔNG!</h1>
                    <p>Gói tập của bạn đã được kích hoạt tự động trên hệ thống (và lưu lên Redis).</p>
                    <p>Mã giao dịch VNPAY: <strong>${vnp_Params["vnp_TransactionNo"]}</strong></p>
                </div>
            `);
        } else {
            // Cập nhật thất bại nếu giao dịch lỗi
            const payment = await prisma.payment.findUnique({
                where: { id: paymentId }
            });

            if (payment && payment.status === "PENDING") {
                await prisma.$transaction(async (tx) => {
                    await tx.payment.update({
                        where: { id: paymentId },
                        data: { status: "FAILED", gateway_response: vnp_Params }
                    });
                    await tx.membership.update({
                        where: { id: payment.membership_id },
                        data: { status: "CANCELLED" }
                    });
                });
                console.log(`[VNPAY Return] Giao dịch thất bại, đã hủy đơn hàng ID: ${paymentId}`);
            }

            return res.send(`
                <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                    <h1 style="color: red;">❌ THANH TOÁN THẤT BẠI</h1>
                    <p>Mã lỗi từ VNPAY: <strong>${responseCode}</strong></p>
                </div>
            `);
        }
    } catch (error) {
        console.error("VNPAY Return Error:", error);
        return res.status(500).send("Lỗi hệ thống: " + (error as Error).message);
    }
};