# Notification API

Base path: `/notifications`

Tài liệu này mô tả các API xem và đánh dấu đã đọc thông báo trong ứng dụng của người dùng, cùng danh sách loại thông báo, sự kiện tạo thông báo và sự kiện realtime qua Socket.IO. Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token (`router.use(authMiddleware)`).

Module chỉ có 3 route, không có API tạo hoặc xóa thông báo. Thông báo do server tự tạo khi có sự kiện nghiệp vụ (xem mục "Sự kiện tạo thông báo").

**Quy tắc sở hữu:** mọi API chỉ thao tác trên thông báo của chính user đang đăng nhập (`userId` lấy từ access token). Không role nào (kể cả `ADMIN`, `STAFF`) xem hoặc sửa được thông báo của người khác. Mọi role (`ADMIN`, `COACH`, `STAFF`, `USER`) đều dùng được cả 3 API, không có khác biệt hành vi theo role.

---

## Đối tượng Notification

```json
{
  "id": 42,
  "userId": 5,
  "title": "Thanh toán thành công",
  "content": "Cảm ơn bạn! Hóa đơn #12 trị giá 500,000đ đã được thanh toán thành công.",
  "type": "PAYMENT_SUCCESS",
  "isRead": false,
  "referenceId": "12",
  "createdAt": "2026-06-24T12:00:00.000Z",
  "updatedAt": "2026-06-24T12:00:00.000Z"
}
```

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `id` | number | Khóa chính |
| `userId` | number | Người nhận thông báo |
| `title` | string | Tiêu đề, tối đa 255 ký tự |
| `content` | string | Nội dung |
| `type` | string | Một giá trị của enum `NotificationType` |
| `isRead` | boolean | Mặc định `false` |
| `referenceId` | string hoặc `null` | ID tham chiếu tới đối tượng liên quan (dạng chuỗi), xem cột `referenceId` ở bảng sự kiện bên dưới. `null` nếu sự kiện không gắn tham chiếu |
| `createdAt` | string (ISO 8601) | Thời điểm tạo |
| `updatedAt` | string (ISO 8601) | Thời điểm cập nhật cuối |

Tên trường là camelCase (đúng như Prisma model `Notification`, không đổi sang snake_case).

## Enum `NotificationType`

Enum khai báo trong `prisma/schema.prisma` gồm 19 giá trị. Chỉ 5 giá trị hiện được code tạo ra; các giá trị còn lại đã khai báo nhưng chưa có nơi nào gọi `createNotification` với chúng.

| Giá trị | Hiện được tạo bởi code | Sự kiện tạo |
| --- | --- | --- |
| `PAYMENT_PENDING` | Có | Đăng ký/nâng cấp gói tập (`membership.registered`, `membership.upgraded`), đăng ký thuê PT (`pt.hired`) |
| `PAYMENT_SUCCESS` | Có | Thanh toán thành công (`payment.success`) |
| `SESSION_CANCELLED` | Có | Admin hủy gói tập (`membership.cancelled_by_admin`), hội viên hủy đơn thuê PT chưa thanh toán (`pt.pending_cancel`) |
| `COACH_CHANGE_REQUESTED` | Có | Hội viên gửi yêu cầu đổi PT (`pt.change_requested`) |
| `COACH_CHANGE_DECISION` | Có | Duyệt hoặc từ chối yêu cầu đổi PT (`pt.change_processed`) |
| `MEMBERSHIP_REGISTERED` | Chưa | |
| `MEMBERSHIP_ACTIVATED` | Chưa | |
| `MEMBERSHIP_EXPIRING` | Chưa | |
| `SESSION_SCHEDULED` | Chưa | |
| `SESSION_RESCHEDULE_REQUESTED` | Chưa | |
| `SESSION_RESCHEDULE_APPROVED` | Chưa | |
| `SESSION_RESCHEDULE_REJECTED` | Chưa | |
| `SESSION_REMINDER` | Chưa | |
| `PT_SESSIONS_RUNNING_LOW` | Chưa | |
| `PAYMENT_FAILED` | Chưa | |
| `NEW_USER_REGISTERED` | Chưa | |
| `EQUIPMENT_REPORTED_BROKEN` | Chưa | |
| `MAINTENANCE_TASK_ASSIGNED` | Chưa | |
| `SYSTEM_ANNOUNCEMENT` | Chưa | |

Lưu ý: `type` không phản ánh chính xác ngữ nghĩa ở một số sự kiện, ví dụ hủy gói tập và hủy đơn thuê PT đều dùng `SESSION_CANCELLED`; đăng ký gói tập/thuê PT dùng `PAYMENT_PENDING`.

---

## GET `/notifications`

Lấy danh sách thông báo của user đang đăng nhập, mới nhất trước, kèm tổng số thông báo chưa đọc.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập, chỉ trả thông báo của chính mình.
- **Query Parameters:**
  - `page` (optional, integer): số trang, mặc định `1`. Giá trị không parse được thành số hoặc bằng `0` sẽ thành `1`.
  - `limit` (optional, integer): số bản ghi/trang, mặc định `15`. Giá trị không parse được hoặc bằng `0` sẽ thành `15`. Không có giới hạn tối đa. Controller không kiểm tra giá trị âm.
  - Không có bộ lọc (không lọc theo `isRead`, `type`, ...).
- **Sắp xếp:** `createdAt` giảm dần. Phân trang theo `skip = (page - 1) * limit`, `take = limit`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách thông báo thành công.",
    "data": {
      "notifications": [
        {
          "id": 42,
          "userId": 5,
          "title": "Thanh toán thành công",
          "content": "Cảm ơn bạn! Hóa đơn #12 trị giá 500,000đ đã được thanh toán thành công.",
          "type": "PAYMENT_SUCCESS",
          "isRead": false,
          "referenceId": "12",
          "createdAt": "2026-06-24T12:00:00.000Z",
          "updatedAt": "2026-06-24T12:00:00.000Z"
        }
      ],
      "totalUnread": 3
    }
  }
  ```
  - `data.notifications`: mảng đối tượng Notification của trang hiện tại (mảng rỗng nếu hết dữ liệu).
  - `data.totalUnread`: tổng số thông báo chưa đọc (`isRead = false`) của user trên toàn bộ danh sách, không chỉ trong trang hiện tại.
  - Response **không có** `meta` và không trả tổng số thông báo, nên client chỉ biết đã hết dữ liệu khi trang trả về ít hơn `limit` bản ghi hoặc rỗng.
- **Lỗi thường gặp:**
  - `401`: thiếu hoặc sai Bearer token, xem mục "Lỗi chung".
  - `500`: lỗi máy chủ (ví dụ lỗi database).

---

## PATCH `/notifications/read-all`

Đánh dấu đã đọc tất cả thông báo chưa đọc của user đang đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Request Body / Query:** không có.
- **Xử lý:** `updateMany` các bản ghi có `userId` = user hiện tại và `isRead = false`, đặt `isRead = true`. Idempotent: gọi khi không còn thông báo chưa đọc vẫn thành công.
- **Thành công `200`** (không có trường `data`):
  ```json
  {
    "success": true,
    "message": "Đã đọc tất cả thông báo."
  }
  ```
- **Lỗi thường gặp:**
  - `401`: thiếu hoặc sai Bearer token.
  - `500`: lỗi máy chủ.

---

## PATCH `/notifications/:id/read`

Đánh dấu đã đọc một thông báo của user đang đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập, chỉ tác động lên thông báo của chính mình.
- **Path Parameters:**
  - `id` (integer, bắt buộc): ID thông báo. Được đọc bằng `parseInt(id, 10)`, nên chuỗi bắt đầu bằng số (ví dụ `12abc`) vẫn được chấp nhận với giá trị `12`.
- **Request Body:** không có.
- **Xử lý:** `updateMany` với điều kiện `id = :id` **và** `userId` = user hiện tại, đặt `isRead = true`. Idempotent.
- **Ownership:** nếu thông báo không tồn tại hoặc thuộc user khác thì không có bản ghi nào bị cập nhật, nhưng API **vẫn trả `200`** (không có `404` hay `403`).
- **Thành công `200`** (không có trường `data`):
  ```json
  {
    "success": true,
    "message": "Đã đọc thông báo."
  }
  ```
- **Lỗi thường gặp:**
  - `400`: `id` không phải số (không parse được):
    ```json
    {
      "success": false,
      "message": "ID thông báo không hợp lệ."
    }
    ```
  - `401`: thiếu hoặc sai Bearer token.
  - `500`: lỗi máy chủ.

---

## Lỗi chung

Các lỗi xác thực Bearer token do `authMiddleware` trả về **không** theo định dạng `success/message`:

| Điều kiện | HTTP | Body |
| --- | --- | --- |
| Thiếu header `Authorization`, không bắt đầu bằng `Bearer ` hoặc token rỗng | `401` | `{ "error": "Unauthorized" }` |
| Token sai chữ ký, hết hạn hoặc payload không hợp lệ | `401` | `{ "error": "Invalid token" }` |

Controller cũng có nhánh dự phòng khi `req.user.userId` rỗng, trả `401`:

```json
{
  "success": false,
  "message": "Chưa xác thực."
}
```

Lỗi không lường trước trả `500` (module không có mã lỗi nghiệp vụ nào):

```json
{
  "success": false,
  "message": "Lỗi máy chủ.",
  "error": "<nội dung exception>"
}
```

---

## Sự kiện tạo thông báo

Thông báo được tạo trong `src/services/event.service.ts`, nơi các service nghiệp vụ phát sự kiện nội bộ bằng `eventEmitter.emit(...)`. Mỗi thông báo được lưu vào bảng `notifications` (`isRead = false`) rồi đẩy realtime qua socket (xem mục "Realtime"). Các điểm cần biết:

- Xử lý bất đồng bộ (không chờ), không nằm trong transaction của nghiệp vụ gốc: API gốc (mua gói, thanh toán, ...) không phụ thuộc vào việc tạo thông báo thành công.
- "Staff/Admin" nghĩa là tất cả user có `role` là `ADMIN` hoặc `STAFF` và `status = ACTIVE`. Mỗi người nhận một thông báo riêng (không có `COACH`, chỉ có 2 trường hợp coach được báo ở sự kiện `pt.change_processed`).

| Sự kiện nội bộ | API phát sự kiện | Người nhận | `type` | `title` | `referenceId` |
| --- | --- | --- | --- | --- | --- |
| `membership.registered` | `POST /membership/buy` | Hội viên mua | `PAYMENT_PENDING` | Đơn đăng ký gói tập thành công | ID membership |
| `membership.registered` | `POST /membership/buy` | Staff/Admin, **chỉ khi** `paymentMethod = CASH` | `PAYMENT_PENDING` | Đơn mua gói tập chờ thu tiền mặt | ID membership |
| `membership.upgraded` | `POST /membership/upgrade` | Hội viên nâng cấp | `PAYMENT_PENDING` | Yêu cầu nâng cấp gói tập | ID membership (mới) |
| `membership.upgraded` | `POST /membership/upgrade` | Staff/Admin, **chỉ khi** `paymentMethod = CASH` | `PAYMENT_PENDING` | Yêu cầu nâng cấp gói chờ thu tiền | ID membership (mới) |
| `membership.cancelled_by_admin` | `POST /membership/:id/cancel` | Chủ gói tập bị hủy | `SESSION_CANCELLED` | Gói tập của bạn đã bị hủy | `null` |
| `payment.success` | `POST /payments/:paymentId/confirm` (xác nhận tiền mặt), `GET /payments/vnpay-ipn` và `GET /payments/vnpay-return` (VNPay báo thành công) | Chủ hóa đơn | `PAYMENT_SUCCESS` | Thanh toán thành công (kèm biểu tượng cảm xúc chúc mừng ở cuối tiêu đề) | ID payment |
| `payment.success` | như trên | Staff/Admin | `PAYMENT_SUCCESS` | Giao dịch mới thành công | ID payment |
| `pt.hired` | `POST /pt-booking/hire` | Hội viên thuê PT | `PAYMENT_PENDING` | Đơn đăng ký thuê PT thành công | ID payment |
| `pt.hired` | `POST /pt-booking/hire` | Staff/Admin (gửi cho mọi phương thức thanh toán, không chỉ `CASH`) | `PAYMENT_PENDING` | Đơn thuê PT chờ thu tiền mặt | ID payment |
| `pt.change_requested` | `POST /pt-booking/change-coach/:assignmentId` (chỉ khi hợp đồng đang `ACTIVE` nên tạo yêu cầu chờ duyệt; nếu đang `PENDING` thì đổi PT trực tiếp và không có thông báo) | Staff/Admin | `COACH_CHANGE_REQUESTED` | Yêu cầu đổi PT mới | ID yêu cầu đổi PT |
| `pt.change_processed` (từ chối) | `PUT /pt-booking/admin/change-request/:requestId/process` | Hội viên gửi yêu cầu | `COACH_CHANGE_DECISION` | Yêu cầu đổi PT bị từ chối | `null` |
| `pt.change_processed` (duyệt, không chênh lệch giá) | như trên | Hội viên gửi yêu cầu | `COACH_CHANGE_DECISION` | Yêu cầu đổi PT thành công | ID yêu cầu đổi PT |
| `pt.change_processed` (duyệt, không chênh lệch giá) | như trên | PT mới | `COACH_CHANGE_DECISION` | Nhận học viên mới | `null` |
| `pt.change_processed` (duyệt, không chênh lệch giá) | như trên | PT cũ | `COACH_CHANGE_DECISION` | Học viên chuyển PT | `null` |
| `pt.pending_cancel` | `POST /pt-booking/my-booking/:id/cancel` | Staff/Admin | `SESSION_CANCELLED` | Đơn thuê PT đã bị hủy | `null` |

Ghi chú:

- `referenceId` không cùng ý nghĩa giữa các sự kiện: với `membership.*` là ID membership (dù `type` là `PAYMENT_PENDING`), với `payment.success` và `pt.hired` là ID payment, với `pt.change_requested`/duyệt đổi PT là ID yêu cầu đổi PT (`CoachChangeRequest`).
- Khi duyệt yêu cầu đổi PT có chênh lệch giá lớn hơn 0, API chỉ tạo hóa đơn chờ thanh toán và **không** phát `pt.change_processed`, nên không có thông báo "Yêu cầu đổi PT thành công" ở bước đó (khi hóa đơn được thanh toán chỉ có thông báo `payment.success`).
- Hóa đơn online quá hạn bị cron chuyển `FAILED` không tạo thông báo (`PAYMENT_FAILED` chưa được dùng).
- Nếu chủ hóa đơn cũng là `ADMIN`/`STAFF` đang hoạt động, người đó nhận 2 thông báo `payment.success` (1 với tư cách chủ hóa đơn, 1 với tư cách Staff/Admin).

---

## Realtime (Socket.IO)

Khi một thông báo được tạo, server đẩy ngay tới user nhận qua Socket.IO (server chạy chung HTTP server, đường dẫn mặc định `/socket.io`, khởi tạo trong `src/services/socket.service.ts`).

- **Kết nối:** truyền access token ở `auth.token` của handshake, hoặc header `Authorization`. Tiền tố `Bearer ` là tùy chọn. Token được verify bằng `JWT_ACCESS_SECRET`.
  ```js
  const socket = io("http://localhost:3000", { auth: { token: "<accessToken>" } });
  socket.on("new_notification", (notification) => { /* ... */ });
  ```
- **Lỗi kết nối** (sự kiện `connect_error` phía client, message):
  - `Chưa cung cấp token xác thực kết nối socket`: không có token.
  - `Token không hợp lệ hoặc đã hết hạn`: token sai hoặc hết hạn.
- **Phòng:** sau khi kết nối thành công, socket tự vào phòng `room_user_<userId>`. Mỗi user chỉ nhận thông báo của mình.
- **Sự kiện `new_notification`:** payload là nguyên đối tượng Notification vừa được lưu (cùng các trường như ở mục "Đối tượng Notification", `isRead = false`).
- CORS của Socket.IO cho phép mọi origin (`*`) với method `GET`, `POST`.
- Chỉ có `new_notification` là sự kiện server phát ra cho thông báo; client không cần gửi sự kiện nào. Việc đánh dấu đã đọc thực hiện qua các API PATCH ở trên, không có sự kiện realtime khi trạng thái đọc thay đổi.
