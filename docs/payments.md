# Payments API

Base path: `/payments`

Các callback webhook của VNPAY (`/payments/vnpay-ipn`, `/payments/vnpay-return`) không cần đăng nhập. Các API còn lại đều yêu cầu Bearer token.

---

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`

Ghi chú về enum:

- Chỉ `VNPAY` có tích hợp cổng thanh toán (API `/payments/:paymentId/pay` và hai callback). `MOMO` và `BANK_TRANSFER` chỉ là giá trị lưu ở hóa đơn, chưa có API/callback riêng.
- `REFUNDED` có trong enum nhưng **không có API hay tác vụ nào trong code đặt trạng thái này**. Module không có API hoàn tiền hoặc hủy hóa đơn riêng.

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
  "created_at": "2026-06-01T00:00:00.000Z"
}
```

- `amount` là kiểu Decimal nên được trả về dạng chuỗi.
- Một hóa đơn gắn với gói tập (`membership_id`) hoặc hợp đồng PT (`coach_assignment_id`). Hóa đơn được tạo bởi các API mua gói / nâng cấp gói (`/membership/*`) và thuê PT / đổi PT (`/pt-booking/*`), không phải bởi module này.
- `transaction_ref` và `gateway_response` được ghi khi hóa đơn được xác nhận (`PAID`) hoặc bị VNPAY báo thất bại (`FAILED`, chỉ ghi `gateway_response`).

---

## Định dạng lỗi

Lỗi do controller/service của module trả về có dạng (không có trường `error`):

```json
{
  "success": false,
  "message": "Không tìm thấy hóa đơn."
}
```

Bảng ánh xạ mã lỗi nội bộ sang HTTP status (hàm `mapError` trong `payment.controller.ts`):

| Mã lỗi | HTTP | `message` |
| --- | --- | --- |
| `PAYMENT_NOT_FOUND` | 404 | Không tìm thấy hóa đơn. |
| `PAYMENT_ALREADY_PROCESSED` | 400 | Hóa đơn này đã được xử lý. |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện hành động này. |
| (mọi lỗi khác) | 500 | Lỗi máy chủ. Vui lòng thử lại sau. |

Ngoài ra, các API có path param `paymentId` trả `400` với `message` "Mã hóa đơn không hợp lệ." khi `paymentId` không phải số. `GET /payments/my-history` xử lý lỗi riêng (xem mục tương ứng).

Lỗi xác thực do `authMiddleware` (mọi route trừ hai callback VNPAY): `401` `{ "error": "Unauthorized" }` khi thiếu header `Authorization: Bearer <token>`, `401` `{ "error": "Invalid token" }` khi token không hợp lệ hoặc hết hạn.

---

## Cấu hình VNPAY (biến môi trường)

Dịch vụ VNPAY (`src/services/vnpay.service.ts`) đọc các biến môi trường sau (thiếu thì dùng giá trị sandbox mặc định trong code):

- `VNP_TMN_CODE`: mã website (`vnp_TmnCode`).
- `VNP_HASH_SECRET`: khóa bí mật dùng ký/kiểm tra chữ ký HMAC-SHA512.
- `VNP_URL`: URL cổng thanh toán (mặc định `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html`).
- `VNP_RETURN_URL`: URL VNPAY chuyển hướng trình duyệt của khách về sau khi thanh toán (`vnp_ReturnUrl`). Để trang kết quả của backend hiển thị, biến này cần trỏ tới `GET /payments/vnpay-return`. Giá trị mặc định khi thiếu biến là `http://localhost:3000/auth/vnpay-callback` (không phải route của backend này). URL IPN (`/payments/vnpay-ipn`) được cấu hình phía VNPAY merchant, không truyền trong link thanh toán.

Chữ ký: các tham số `vnp_*` được sắp xếp theo tên, mã hóa URL (khoảng trắng thành `+`), nối `key=value` bằng `&` rồi ký HMAC-SHA512 bằng `VNP_HASH_SECRET`. Khi kiểm tra callback, `vnp_SecureHash` và `vnp_SecureHashType` bị loại khỏi chuỗi cần ký.

---

## Luồng xác nhận thanh toán (dùng chung cho VNPAY và tiền mặt)

Cả `GET /payments/vnpay-ipn`, `GET /payments/vnpay-return` (khi `vnp_ResponseCode = 00`) và `POST /payments/:paymentId/confirm` đều gọi `PaymentService.confirmPayment(role, paymentId, { transactionRef, gatewayResponse })`:

1. Hóa đơn không tồn tại thì lỗi `PAYMENT_NOT_FOUND`; hóa đơn không ở trạng thái `PENDING` thì lỗi `PAYMENT_ALREADY_PROCESSED`.
2. Điều phối theo loại hóa đơn:
   - Có `membership_id`: gọi `MembershipsService.confirmPayment` (trong một transaction: hóa đơn thành `PAID` kèm `paid_at`, `transaction_ref`, `gateway_response`; gói `ACTIVE` khác của user, nếu có, chuyển thành `UPGRADED` với `is_active = false` và `end_date` = hiện tại; gói mới của hóa đơn thành `ACTIVE`, `is_active = true`). Sau đó ghi cache Redis `membership:active:<userId>` (kèm tiền tố `REDIS_KEY_PREFIX`) với TTL đến `end_date` của gói. **Chỉ chấp nhận role `ADMIN` hoặc `STAFF`**, role khác (kể cả `SYSTEM`) bị lỗi `FORBIDDEN`.
   - Có `coach_assignment_id`: gọi `PtBookingService.confirmPayment` (chấp nhận role `ADMIN`, `STAFF`, `SYSTEM`; role khác bị `FORBIDDEN`). Nếu hóa đơn là khoản chênh lệch của một yêu cầu đổi PT/gói thì thực thi đổi PT/gói; ngược lại kích hoạt hợp đồng PT (`ACTIVE`, `startDate` = hiện tại, `endDate` = hiện tại + `durationDays` của gói PT, mặc định 30 ngày nếu không có). Sau đó xóa cache Redis `pt_assignment:active:<userId>`.
   - Không thuộc hai loại trên: chỉ cập nhật hóa đơn thành `PAID` (`paid_at` = hiện tại, `transaction_ref`, `gateway_response`), **không kiểm tra role**.
3. Đọc lại hóa đơn đã cập nhật và phát sự kiện `payment.success`. Listener của sự kiện tạo thông báo (bản ghi Notification kèm đẩy qua socket sự kiện `new_notification`) loại `PAYMENT_SUCCESS`: một thông báo cho hội viên chủ hóa đơn ("Thanh toán thành công") và một thông báo cho mỗi tài khoản `ADMIN`/`STAFF` đang `ACTIVE` ("Giao dịch mới thành công").

---

## Tác vụ nền: tự động hết hạn hóa đơn online chưa thanh toán

Không phải API, nhưng ảnh hưởng trực tiếp tới trạng thái hóa đơn. Cron `startCleanupCron` (`src/services/cron.service.ts`) được khởi động khi server chạy, dùng `setInterval` **mỗi 60 giây** (lần chạy đầu tiên sau 60 giây, không chạy ngay lúc khởi động).

**Quy tắc chọn hóa đơn hết hạn** (cả ba điều kiện):

- `status = PENDING`
- `method` thuộc `VNPAY`, `MOMO`, `BANK_TRANSFER` (hóa đơn `CASH` **không bao giờ** bị cron quét, vì tiền mặt được nhân viên duyệt thủ công)
- `created_at` cũ hơn 15 phút so với thời điểm quét. Mốc tính là thời điểm hóa đơn được tạo, không phải thời điểm tạo link VNPAY hay thời điểm đổi phương thức.

**Xử lý** (tất cả hóa đơn tìm được trong một lần quét chạy trong một transaction; lỗi thì rollback toàn bộ và thử lại ở lần quét sau, chỉ ghi log):

- Hóa đơn thuê PT (`coach_assignment_id`): chỉ xử lý khi hợp đồng PT (`CoachAssignment`) đang `PENDING`, khi đó hóa đơn chuyển `FAILED` và hợp đồng chuyển `CANCELLED`. Nếu hợp đồng đang `ACTIVE` (hóa đơn đóng thêm tiền chênh lệch khi đổi gói) hoặc trạng thái khác thì bị bỏ qua, hóa đơn vẫn `PENDING` và được cho phép thanh toán muộn.
- Hóa đơn gói tập (`membership_id`): hóa đơn được chuyển `FAILED`, sau đó membership tương ứng bị **xóa cứng** khỏi database. Do khóa ngoại `payments.membership_id` được khai báo `ON DELETE CASCADE`, bản ghi hóa đơn cũng bị xóa theo cùng lúc, nên hóa đơn này biến mất khỏi `/payments/list`, `/payments/my-history` và `GET /payments/:paymentId` trả `404`.
- Hóa đơn không thuộc gói tập lẫn hợp đồng PT: không bị đụng tới.
- Không phát sự kiện, không gửi thông báo khi hết hạn.

**Hệ quả với API:** sau khi bị cron xử lý, `POST /payments/:paymentId/pay` trả `404 PAYMENT_NOT_FOUND` (hóa đơn gói tập đã bị xóa) hoặc `400 PAYMENT_ALREADY_PROCESSED` (hóa đơn PT đã `FAILED`); callback VNPAY đến muộn nhận `RspCode 01` (hóa đơn gói tập không còn) hoặc `RspCode 02` (hóa đơn PT đã `FAILED`).

---

## GET `/payments/vnpay-ipn`

Webhook (IPN - Instant Payment Notification) nhận thông tin phản hồi từ VNPAY (server-to-server) để cập nhật trạng thái hóa đơn tự động.

- **Quyền hạn:** Không yêu cầu đăng nhập (xác thực bằng chữ ký `vnp_SecureHash`).
- **Query Parameters:** Các tham số do VNPAY gửi sang. Các tham số được code sử dụng:
  - `vnp_TxnRef`: Mã tham chiếu giao dịch có dạng `{paymentId}_{yyyyMMddHHmmss}` (do backend tạo ở `/pay`). Code dùng `parseInt` nên chỉ lấy phần `paymentId` trước dấu `_`.
  - `vnp_Amount`: Số tiền nhân 100 (đơn vị VNPAY). Code chia cho 100 rồi so với `amount` của hóa đơn.
  - `vnp_ResponseCode`: `00` là giao dịch thành công, giá trị khác là thất bại.
  - `vnp_TransactionNo`: Mã giao dịch bên VNPAY, lưu vào `transaction_ref`.
  - `vnp_SecureHash` (và tùy chọn `vnp_SecureHashType`): chữ ký HMAC-SHA512 của toàn bộ tham số còn lại.
  - Toàn bộ query được lưu nguyên vào `gateway_response` của hóa đơn.
- **Các bước xử lý theo thứ tự:**
  1. Kiểm tra chữ ký.
  2. Tìm hóa đơn theo `paymentId`.
  3. So khớp số tiền.
  4. Hóa đơn phải đang `PENDING`.
  5. Nếu `vnp_ResponseCode = 00`: gọi luồng xác nhận thanh toán (xem mục "Luồng xác nhận thanh toán") với role `"SYSTEM"`, `transactionRef = vnp_TransactionNo`. Ngược lại: cập nhật hóa đơn thành `FAILED` và ghi `gateway_response` (không đổi gói tập / hợp đồng PT liên quan).
- **Response:** Luôn là HTTP `200` với JSON theo đặc tả VNPAY, kết quả nằm ở `RspCode`:

  | `RspCode` | `Message` | Khi nào |
  | --- | --- | --- |
  | `00` | `Confirm success` | Xác nhận thành công (`vnp_ResponseCode = 00`) |
  | `00` | `Confirm success (Failed Payment)` | Đã ghi nhận giao dịch thất bại (`vnp_ResponseCode` khác `00`), hóa đơn thành `FAILED` |
  | `97` | `Invalid Signature` | Chữ ký không hợp lệ |
  | `01` | `Order not found` | Không tìm thấy hóa đơn |
  | `04` | `Invalid Amount` | `vnp_Amount / 100` khác `amount` của hóa đơn |
  | `02` | `Order already confirmed` | Hóa đơn không còn `PENDING` |
  | `99` | `System Error` | Có exception bất kỳ (ví dụ `vnp_TxnRef` không phải số, lỗi database, lỗi trong luồng xác nhận) |

  ```json
  {
    "RspCode": "00",
    "Message": "Confirm success"
  }
  ```
- **Lưu ý về hóa đơn gói tập:** callback gọi luồng xác nhận với role `"SYSTEM"`, nhưng `MembershipsService.confirmPayment` chỉ cho `ADMIN`/`STAFF` nên với hóa đơn có `membership_id` việc xác nhận ném `FORBIDDEN` và API trả `RspCode 99` (`System Error`); hóa đơn vẫn `PENDING` (xem mục "Lưu ý về hành vi hiện tại" ở cuối tài liệu). Với hóa đơn thuê PT (`coach_assignment_id`), role `SYSTEM` được chấp nhận nên xác nhận hoạt động bình thường.

---

## GET `/payments/vnpay-return`

Trang callback UI hiển thị kết quả giao dịch cho khách hàng sau khi thanh toán qua cổng VNPAY (trình duyệt của khách được VNPAY chuyển về URL `VNP_RETURN_URL`).

- **Quyền hạn:** Không yêu cầu đăng nhập (xác thực bằng chữ ký `vnp_SecureHash`).
- **Query Parameters:** Các tham số `vnp_*` do VNPAY gắn vào URL, cùng ý nghĩa như ở `vnpay-ipn` (dùng `vnp_TxnRef`, `vnp_ResponseCode`, `vnp_TransactionNo`, `vnp_SecureHash`). API này **không** kiểm tra `vnp_Amount`.
- **Response:** Luôn là HTTP `200`, nội dung là chuỗi HTML (không có redirect, không có query `?payment=...`). Các trường hợp:

  | Điều kiện | Xử lý | HTML trả về |
  | --- | --- | --- |
  | Chữ ký không hợp lệ | Không làm gì | `<h1>Lỗi: Chữ ký không hợp lệ!</h1>` |
  | `vnp_ResponseCode = 00` | Nếu hóa đơn tồn tại và đang `PENDING`: gọi luồng xác nhận thanh toán với role `"SYSTEM"` (giống IPN). Nếu hóa đơn không tồn tại hoặc không còn `PENDING`: không làm gì thêm | Trang "🎉 THANH TOÁN THÀNH CÔNG!" kèm "Mã giao dịch: `vnp_TransactionNo`" |
  | `vnp_ResponseCode` khác `00` | Nếu hóa đơn tồn tại và đang `PENDING`: cập nhật `FAILED` và ghi `gateway_response` | Trang "❌ THANH TOÁN THẤT BẠI" kèm "Mã lỗi từ VNPAY: `vnp_ResponseCode`" |
  | Có exception (ví dụ luồng xác nhận ném lỗi) | Không làm gì thêm | `<h1>Lỗi máy chủ khi xử lý callback VNPAY</h1>` |

- **Lưu ý:** Với hóa đơn có `membership_id`, do luồng xác nhận với role `"SYSTEM"` ném `FORBIDDEN` (xem mục "Lưu ý về hành vi hiện tại" ở cuối tài liệu), khi `vnp_ResponseCode = 00` trang trả về là "Lỗi máy chủ khi xử lý callback VNPAY" và hóa đơn vẫn `PENDING`. Trang "THANH TOÁN THÀNH CÔNG" chỉ xuất hiện khi luồng xác nhận không ném lỗi hoặc hóa đơn không còn `PENDING`/không tồn tại.

---

## POST `/payments/:paymentId/pay`

Tạo đường dẫn (URL) thanh toán online qua VNPAY cho một hóa đơn đang chờ thanh toán.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập nhưng chỉ với hóa đơn của chính mình (`payment.user_id` trùng user trong token). `ADMIN`/`STAFF` cũng không tạo được link cho hóa đơn của người khác.
- **Path Param:** `paymentId` (số nguyên) - ID hóa đơn.
- **Request Body:** Không có (không đọc body).
- **Hành vi:**
  1. Không tìm thấy hóa đơn hoặc hóa đơn không thuộc user đang gọi thì trả `404 PAYMENT_NOT_FOUND`.
  2. Hóa đơn không ở trạng thái `PENDING` (đã `PAID`, `FAILED` hoặc `REFUNDED`) thì trả `400 PAYMENT_ALREADY_PROCESSED`.
  3. Nếu `method` của hóa đơn khác `VNPAY` (ví dụ `CASH`, `MOMO`, `BANK_TRANSFER`), hệ thống **cập nhật `method` của hóa đơn thành `VNPAY`** (lưu vào database) trước khi tạo link. `created_at` không đổi.
  4. Sinh link VNPAY với các tham số: `vnp_Version=2.1.0`, `vnp_Command=pay`, `vnp_TmnCode`, `vnp_Locale=vn`, `vnp_CurrCode=VND`, `vnp_TxnRef={paymentId}_{yyyyMMddHHmmss}`, `vnp_OrderInfo="Thanh toan hoa don ID: {paymentId}"`, `vnp_OrderType=other`, `vnp_Amount=amount*100`, `vnp_ReturnUrl` (từ `VNP_RETURN_URL`), `vnp_IpAddr` (IP client từ `req.ip`, mặc định `127.0.0.1`), `vnp_CreateDate`, `vnp_SecureHash` (HMAC-SHA512). Không truyền `vnp_ExpireDate`.
  - Có thể gọi nhiều lần cho cùng một hóa đơn `PENDING`, mỗi lần trả một link mới.
- **Thành công `200`:** (lưu ý là `200`, không phải `201`)
  ```json
  {
    "success": true,
    "message": "Tạo link thanh toán VNPAY thành công.",
    "data": {
      "paymentId": 12,
      "amount": "1500000",
      "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=150000000&vnp_Command=pay&..."
    }
  }
  ```
  - `amount` là số tiền hóa đơn (Decimal, dạng chuỗi), không nhân 100.
- **Lỗi thường gặp:**
  - `400`: `paymentId` không phải số ("Mã hóa đơn không hợp lệ.").
  - `PAYMENT_NOT_FOUND` (404): Không tìm thấy hóa đơn hoặc không thuộc về người dùng đang gọi.
  - `PAYMENT_ALREADY_PROCESSED` (400): Hóa đơn không còn ở trạng thái `PENDING` (đã thanh toán, đã thất bại hoặc đã hoàn tiền).
- **Lưu ý:** Hóa đơn online `PENDING` bị cron tự động hết hạn sau 15 phút kể từ `created_at` (xem mục "Tác vụ nền" ở trên). Hóa đơn `CASH` được đổi sang `VNPAY` ở bước 3 sẽ trở thành đối tượng của cron, và nếu đã tạo quá 15 phút thì sẽ bị xử lý ở lần quét kế tiếp (tối đa khoảng 1 phút sau).

---

## GET `/payments/my-history`

Hội viên tự xem lịch sử các giao dịch thanh toán của chính mình.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (chỉ trả hóa đơn của user trong token).
- **Query Parameters:** Không có. Không phân trang, trả toàn bộ.
- **Thành công `200`:** `data` là mảng hóa đơn, sắp xếp `created_at` giảm dần. Mỗi phần tử là Payment kèm:
  - `membership`: Membership của hóa đơn (kèm `plan`), hoặc `null`.
  - `coachAssignment`: Hợp đồng PT của hóa đơn (kèm `ptPackage`), hoặc `null`.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "user_id": 1,
        "membership_id": 1,
        "plan_id": 1,
        "coach_assignment_id": null,
        "amount": "500000",
        "method": "CASH",
        "status": "PAID",
        "transaction_ref": "CASH_CONFIRMED_BY_STAFF",
        "gateway_response": {
          "confirmedBy": "STAFF"
        },
        "paid_at": "2026-06-01T00:10:00.000Z",
        "created_at": "2026-06-01T00:00:00.000Z",
        "membership": {
          "id": 1,
          "status": "ACTIVE",
          "plan": {
            "id": 1,
            "name": "Gói 1 tháng"
          }
        },
        "coachAssignment": null
      }
    ]
  }
  ```
  (ví dụ rút gọn: `membership`, `plan`, `coachAssignment` thực tế trả đầy đủ các trường của bản ghi tương ứng.)
- **Lỗi:** Mọi lỗi (kể cả thiếu `userId` trong token) đều trả `500` với `message` là **thông điệp lỗi gốc** của exception, không qua bảng ánh xạ lỗi:
  ```json
  {
    "success": false,
    "message": "FORBIDDEN"
  }
  ```

---

## GET `/payments/:paymentId`

Xem thông tin chi tiết một hóa đơn cụ thể.

- **Quyền hạn:** Chủ sở hữu hóa đơn, `ADMIN` hoặc `STAFF`. Tài khoản khác nhận `403`.
- **Path Param:** `paymentId` (số nguyên) - ID hóa đơn.
- **Thành công `200`:** `data` là Payment kèm các quan hệ:
  - `user`: `{ id, name, email, phone }` của chủ hóa đơn.
  - `membership`: Membership kèm `plan` (hoặc `null`).
  - `coachAssignment`: Hợp đồng PT kèm `ptPackage` và `coach` (hồ sơ HLV kèm `user: { name }`), hoặc `null`.
  ```json
  {
    "success": true,
    "data": {
      "id": 12,
      "user_id": 5,
      "membership_id": null,
      "plan_id": null,
      "coach_assignment_id": 3,
      "amount": "1500000",
      "method": "CASH",
      "status": "PENDING",
      "transaction_ref": null,
      "gateway_response": null,
      "paid_at": null,
      "created_at": "2026-06-24T10:00:00.000Z",
      "user": {
        "id": 5,
        "name": "Nguyen Van A",
        "email": "a@example.com",
        "phone": "0900000000"
      },
      "membership": null,
      "coachAssignment": {
        "id": 3,
        "status": "PENDING",
        "ptPackage": {
          "id": 1,
          "name": "Gói 12 buổi"
        },
        "coach": {
          "id": 2,
          "speciality": "Thể hình",
          "user": {
            "name": "HLV Nguyễn Văn Hùng"
          }
        }
      }
    }
  }
  ```
  (ví dụ rút gọn: `coachAssignment`, `ptPackage`, `coach` thực tế trả đầy đủ các trường của bản ghi.)
- **Lỗi thường gặp:**
  - `400`: `paymentId` không phải số ("Mã hóa đơn không hợp lệ.").
  - `PAYMENT_NOT_FOUND` (404): Không tìm thấy hóa đơn.
  - `FORBIDDEN` (403): Không phải chủ hóa đơn và không phải `ADMIN`/`STAFF`.

---

## POST `/payments/:paymentId/confirm`

Lễ tân (Staff/Admin) xác nhận hội viên thanh toán trực tiếp bằng tiền mặt (CASH) tại quầy. Hệ thống kích hoạt gói tập hoặc hợp đồng PT tương ứng với hóa đơn.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - Controller không tự kiểm tra role mà chuyển role trong token xuống luồng xác nhận; với hóa đơn gói tập / hợp đồng PT, role khác `ADMIN`/`STAFF` bị `FORBIDDEN` (`403`) ở tầng service.
  - API **không kiểm tra `method` = `CASH`**: có thể xác nhận bất kỳ hóa đơn `PENDING` nào.
- **Path Param:** `paymentId` (số nguyên) - ID hóa đơn.
- **Request Body:** Không có (không đọc body).
- **Hành vi:** Gọi luồng xác nhận thanh toán (xem mục "Luồng xác nhận thanh toán") với `transactionRef = "CASH_CONFIRMED_BY_{role}"` (ví dụ `CASH_CONFIRMED_BY_STAFF`) và `gateway_response = { "confirmedBy": "{role}" }`. Hóa đơn chuyển `PAID`, `paid_at` = hiện tại; gói tập / hợp đồng PT được kích hoạt; cập nhật Redis; phát sự kiện `payment.success` (thông báo cho hội viên và toàn bộ `ADMIN`/`STAFF` đang hoạt động).
- **Thành công `200`:** (không trả `data`)
  ```json
  {
    "success": true,
    "message": "Duyệt thanh toán tiền mặt thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `400`: `paymentId` không phải số ("Mã hóa đơn không hợp lệ.").
  - `PAYMENT_NOT_FOUND` (404): Không tìm thấy hóa đơn.
  - `PAYMENT_ALREADY_PROCESSED` (400): Hóa đơn không còn ở trạng thái `PENDING`.
  - `FORBIDDEN` (403): Role không phải `ADMIN`/`STAFF` (với hóa đơn gói tập hoặc hợp đồng PT).
  - `500`: các lỗi khác trong quá trình kích hoạt (ví dụ lỗi database).

---

## GET `/payments/list`

Ban quản trị xem toàn bộ danh sách hóa đơn thanh toán trong hệ thống, hỗ trợ tìm kiếm, lọc và phân trang.

- **Quyền hạn:** `ADMIN`, `STAFF` (role khác nhận `403 FORBIDDEN`).
  - `STAFF` và `ADMIN` đều xem được toàn bộ hóa đơn của phòng tập, response giống nhau.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số lượng hóa đơn/trang, mặc định `10`. Không có giới hạn tối đa.
  - `status` (optional): Lọc theo trạng thái `PENDING`, `PAID`, `FAILED`, `REFUNDED`. Không validate: giá trị không thuộc enum gây lỗi `500`.
  - `search` (optional): Tìm theo tên (`name`), email hoặc số điện thoại (`phone`) của khách hàng sở hữu hóa đơn, khớp chuỗi con, không phân biệt hoa/thường (điều kiện OR giữa ba trường; kết hợp AND với `status`).
  - `page`/`limit` không được validate: giá trị không phải số hoặc âm có thể làm truy vấn lỗi (`500`); `limit=0` trả `data` rỗng và `meta.totalPages` là `null` (do chia cho 0).
- **Sắp xếp:** `created_at` giảm dần.
- **Thành công `200`:** `data` là mảng Payment (chỉ các trường của bảng payment, **không kèm** thông tin `user`, `membership` hay `coachAssignment`), `meta` là thông tin phân trang.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 12,
        "user_id": 5,
        "membership_id": 4,
        "plan_id": 1,
        "coach_assignment_id": null,
        "amount": "1500000",
        "method": "CASH",
        "status": "PENDING",
        "transaction_ref": null,
        "gateway_response": null,
        "paid_at": null,
        "created_at": "2026-06-24T10:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
  - Muốn lấy thông tin hội viên/gói của một hóa đơn thì gọi tiếp `GET /payments/:paymentId`.
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `500`: `status`, `page` hoặc `limit` không hợp lệ hoặc lỗi database.

---

## Lưu ý về hành vi hiện tại

- **Thanh toán VNPAY cho gói tập không thể tự xác nhận:** hai callback VNPAY gọi luồng xác nhận với role `"SYSTEM"`, nhưng `MembershipsService.confirmPayment` chỉ cho `ADMIN`/`STAFF`. Với hóa đơn có `membership_id`, IPN trả `RspCode 99`, trang return hiển thị "Lỗi máy chủ khi xử lý callback VNPAY", hóa đơn vẫn `PENDING` và sẽ bị cron xóa sau 15 phút kể từ `created_at`, dù khách đã bị trừ tiền ở VNPAY. Chỉ hóa đơn thuê PT (`PtBookingService.confirmPayment` cho phép `SYSTEM`) được xác nhận tự động thành công. Cách duy nhất để kích hoạt gói tập là `ADMIN`/`STAFF` gọi `POST /payments/:paymentId/confirm`.
- Khi VNPAY báo thất bại (IPN hoặc return với `vnp_ResponseCode` khác `00`), chỉ hóa đơn được đặt `FAILED`; membership hoặc hợp đồng PT liên quan không bị hủy, và vì hóa đơn không còn `PENDING` nên không thể gọi lại `/pay` cho hóa đơn đó.
- `POST /payments/:paymentId/confirm` không kiểm tra `method = CASH`, và nhánh hóa đơn không thuộc gói tập/hợp đồng PT không kiểm tra role.
