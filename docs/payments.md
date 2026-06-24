# Payments API

Base path: `/payments`

Các callback webhook của VNPAY không cần đăng nhập. Các API còn lại đều yêu cầu Bearer token.

---

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`

---

## Kiểu dữ liệu Payment

```json
{
  "id": 1,
  "user_id": 1,
  "membership_id": 1,
  "plan_id": 1,
  "coach_assignment_id": null,
  "amount": "500000",
  "method": "VNPAY",
  "status": "PENDING",
  "transaction_ref": null,
  "gateway_response": null,
  "paid_at": null,
  "branchId": 1,
  "created_at": "2026-06-01T00:00:00.000Z"
}
```

---

## GET `/payments/vnpay-ipn`

Webhook nhận thông tin phản hồi từ VNPAY để cập nhật trạng thái tự động.

- **Quyền hạn:** Không yêu cầu đăng nhập.
- **Query Parameters:** Các tham số do VNPAY gửi sang (`vnp_TxnRef`, `vnp_ResponseCode`, `vnp_Amount`, `vnp_SecureHash`, ...).
- **Thành công `200`:** Trả về đối tượng JSON theo đặc tả kết quả của VNPAY (Ví dụ: `{"RspCode": "00", "Message": "Confirm success"}`).

---

## GET `/payments/vnpay-return`

Trang callback UI hiển thị kết quả giao dịch thanh toán cho khách hàng sau khi thanh toán qua cổng VNPAY.

- **Quyền hạn:** Không yêu cầu đăng nhập.
- **Thành công `200`:** Trả về một giao diện HTML thông báo "THANH TOÁN THÀNH CÔNG!" hoặc "THANH TOÁN THẤT BẠI".

---

## POST `/payments/:paymentId/pay`

Tạo đường dẫn (URL) thanh toán online qua VNPAY cho một hóa đơn.

- **Quyền hạn:** Hội viên sở hữu hóa đơn đó.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Tạo link thanh toán VNPAY thành công.",
    "data": {
      "paymentId": 12,
      "amount": "1500000",
      "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
    }
  }
  ```
- **Lỗi thường gặp:**
  - `PAYMENT_NOT_FOUND` (404): Không tìm thấy hóa đơn hoặc không thuộc về người dùng đang gọi.
  - `PAYMENT_ALREADY_PROCESSED` (400): Hóa đơn đã thanh toán hoặc đã thất bại.

---

## GET `/payments/my-history`

Hội viên tự xem lịch sử các giao dịch thanh toán của chính mình.

- **Quyền hạn:** Mọi hội viên đã đăng nhập.
- **Thành công `200`:** `data` là mảng danh sách hóa đơn.

---

## GET `/payments/:paymentId`

Xem thông tin chi tiết một hóa đơn cụ thể.

- **Quyền hạn:** Chủ sở hữu hóa đơn, `ADMIN` hoặc `STAFF`.
  - **Giới hạn chi nhánh:** Tài khoản `STAFF` chỉ có quyền xem chi tiết hóa đơn thuộc **chi nhánh của STAFF đó**. Nếu hóa đơn thuộc chi nhánh khác, trả lỗi `FORBIDDEN` (403).
- **Thành công `200`:** `data` là đối tượng Payment chi tiết.

---

## POST `/payments/:paymentId/confirm`

Lễ tân (Staff/Admin) xác nhận hội viên thanh toán trực tiếp bằng tiền mặt (CASH) tại quầy. Hệ thống sẽ kích hoạt gói tập hoặc hợp đồng PT tương ứng với hóa đơn.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Giới hạn chi nhánh:**
    - Tài khoản `STAFF`: Tự động ghi nhận số tiền thu được tại chi nhánh của STAFF đó. Nếu STAFF chưa được gán chi nhánh trong hệ thống, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN`: Mặc định ghi nhận theo `branchId` gửi kèm trong request body (hoặc null nếu không gửi).
- **Request Body:**
  ```json
  {
    "branchId": 1
  }
  ```
  - **Lưu ý:** `branchId` là optional (chỉ ADMIN có quyền truyền tham số này để điều phối chi nhánh thu tiền mặt).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Duyệt thanh toán tiền mặt thành công."
  }
  ```

---

## GET `/payments/list`

Ban quản trị xem toàn bộ danh sách hóa đơn thanh toán trong hệ thống, hỗ trợ tìm kiếm, lọc và phân trang.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF` chỉ có thể xem danh sách hóa đơn thuộc **chi nhánh của STAFF đó**. Nếu STAFF chưa được gán chi nhánh, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN` có thể xem toàn bộ hoặc lọc theo chi nhánh bất kỳ.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số lượng hóa đơn/trang, mặc định `10`.
  - `status` (optional): Lọc theo trạng thái `PENDING`, `PAID`, `FAILED`, `REFUNDED`.
  - `search` (optional): Tìm theo tên (`name`), email, hoặc số điện thoại (`phone`) của khách hàng sở hữu hóa đơn.
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN).

- **Thành công `200`:** Trả về danh sách hóa đơn và meta phân trang.
