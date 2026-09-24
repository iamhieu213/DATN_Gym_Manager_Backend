# Check-in API

Base path: `/check-in`

Tất cả API trong module này cần Bearer token.

- Thiếu header `Authorization: Bearer <token>` -> `401` với body `{ "error": "Unauthorized" }`.
- Token sai/hết hạn -> `401` với body `{ "error": "Invalid token" }`.
- Hai trường hợp trên do `authMiddleware` trả về, **không** có `success`/`message`. `role` của người gọi lấy từ token.

### Mã lỗi của module

Response lỗi do controller trả về có dạng:

```json
{
  "success": false,
  "message": "Hội viên chưa đăng ký hoặc không có gói tập nào đang hoạt động.",
  "error": "NO_ACTIVE_MEMBERSHIP"
}
```

| `error` | HTTP | `message` |
| --- | --- | --- |
| `UNAUTHORIZED` | `401` | Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. |
| `FORBIDDEN` | `403` | Bạn không có quyền thực hiện chức năng này. |
| `USER_NOT_FOUND` | `404` | Không tìm thấy thông tin hội viên ứng với số điện thoại này. |
| `NO_ACTIVE_MEMBERSHIP` | `400` | Hội viên chưa đăng ký hoặc không có gói tập nào đang hoạt động. |
| `MEMBERSHIP_EXPIRED` | `400` | Gói tập của hội viên đã hết hạn sử dụng. Vui lòng gia hạn thêm. |
| `BAD_REQUEST` | `400` | Số điện thoại không được để trống. (do controller trả trực tiếp khi thiếu `phone`) |
| (lỗi khác) | `500` | Đã xảy ra lỗi hệ thống khi điểm danh. Vui lòng thử lại sau. |

Lưu ý chung:
- Với lỗi `500`, trường `error` chứa nguyên văn `message` của exception (ví dụ `Cannot read properties of undefined (reading 'phone')`).
- `POST /check-in` cần gửi `Content-Type: application/json`. Không có body JSON thì `req.body` là `undefined` và request trả `500`.
- `page`/`limit` ở hai API lịch sử được đọc bằng `Number(...)` và **không được validate**, cũng **không có giới hạn tối đa** cho `limit`. Giá trị không phải số (ví dụ `page=abc`) làm truy vấn lỗi và trả `500`.
- Module không phát event, không gửi thông báo/socket.

---

## POST `/check-in`

Admin/staff check-in hội viên bằng số điện thoại để điểm danh vào phòng tập.

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác (`USER`, `COACH`) -> `403 FORBIDDEN` (kiểm tra trước khi đọc body).
- **Request Body:**
  ```json
  {
    "phone": "0900000000"
  }
  ```
  - `phone` (bắt buộc, string): Số điện thoại của hội viên. Tìm theo so khớp **chính xác** với `users.phone` (không trim, không chuẩn hóa định dạng). Thiếu hoặc rỗng -> `400 BAD_REQUEST`.

### Quy tắc nghiệp vụ (theo thứ tự thực hiện)

1. Tìm user theo `phone`. Không có -> `USER_NOT_FOUND` (404). API **không** kiểm tra `role` hay `status` của user tìm được (tài khoản `SUSPENDED`/`BANNED`/`DELETED` hoặc không phải `USER` vẫn có thể được check-in nếu có gói tập đang hoạt động).
2. Kiểm tra gói tập đang hoạt động, ưu tiên đọc từ Redis:
   - **Key cache:** `membership:active:<userId>` (thêm tiền tố `REDIS_KEY_PREFIX`, mặc định `hipu-hrm:dev:`).
   - **Cache hit:** dùng luôn giá trị cache làm `membership` của response. **Không** truy vấn DB và **không** kiểm tra lại hạn/trạng thái gói; thời hạn của gói được đảm bảo bởi TTL của key (bằng thời gian còn lại đến `end_date`).
   - **Cache miss:** truy vấn DB gói tập của user có `is_active = true` và `status = ACTIVE` (kèm `plan`).
     - Không có -> `NO_ACTIVE_MEMBERSHIP` (400).
     - `end_date` nhỏ hơn thời điểm hiện tại -> `MEMBERSHIP_EXPIRED` (400). `end_date` là cột kiểu DATE (00:00:00 UTC), nên gói được coi là hết hạn từ 00:00 UTC của ngày `end_date`.
     - Còn hạn -> ghi cache `membership:active:<userId>` với TTL = số giây còn lại đến `end_date`, giá trị:
       ```json
       {
         "membershipId": 1,
         "planId": 1,
         "planName": "Gói 1 tháng",
         "startDate": "2026-06-01T00:00:00.000Z",
         "endDate": "2026-07-01T00:00:00.000Z"
       }
       ```
       (Nếu TTL tính ra `<= 0` cũng trả `MEMBERSHIP_EXPIRED`.)
   - Nếu Redis bị tắt (`REDIS_ENABLED=false`) thì luôn đọc từ DB (không có cache). Thao tác Redis không được bọc `try/catch`: khi Redis bật nhưng lỗi kết nối, request trả `500`.
   - Cùng key `membership:active:<userId>` cũng được các API khác ghi/xóa: được ghi khi thanh toán gói tập được xác nhận (giá trị rút gọn như trên), và bị xóa khi Admin hủy gói (`POST /membership/:id/cancel`). `GET /membership/active` luôn đọc database nên không đọc/ghi key này. Vì cả hai nơi ghi (check-in và xác nhận thanh toán) đều dùng cùng dạng rút gọn nên `data.membership` trong response check-in luôn có dạng rút gọn đó.
3. Ghi một bản ghi mới vào bảng `check_ins` (`userId`, `checkInAt = now()`).
   - **Không có quy tắc chống check-in trùng:** một hội viên có thể check-in nhiều lần trong ngày, mỗi lần gọi API tạo thêm một lượt.
   - Check-in không thay đổi/trừ gói tập.

- **Thành công `200`** (lưu ý: là `200`, không phải `201`):
  ```json
  {
    "success": true,
    "message": "Chào mừng Nguyen Van A đến tập! Điểm danh thành công.",
    "data": {
      "checkInId": 1,
      "checkInAt": "2026-06-01T00:00:00.000Z",
      "user": {
        "id": 1,
        "name": "Nguyen Van A",
        "phone": "0900000000",
        "avatarUrl": null
      },
      "membership": {
        "membershipId": 1,
        "planId": 1,
        "planName": "Gói 1 tháng",
        "startDate": "2026-06-01T00:00:00.000Z",
        "endDate": "2026-07-01T00:00:00.000Z"
      }
    }
  }
  ```
  - `data.user` chỉ gồm `id`, `name`, `phone`, `avatarUrl` (không có `email`).
  - `data.membership`: dạng rút gọn `{ membershipId, planId, planName, startDate, endDate }` (xem mục cache ở trên).

- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): Thiếu `phone` hoặc rỗng.
  - `USER_NOT_FOUND` (404): Số điện thoại chưa tương ứng với tài khoản nào.
  - `NO_ACTIVE_MEMBERSHIP` (400): Hội viên không có gói tập nào đang hoạt động.
  - `MEMBERSHIP_EXPIRED` (400): Gói tập của hội viên đã hết hạn.
  - `FORBIDDEN` (403): Không có quyền (không phải `ADMIN`/`STAFF`).
  - `500`: không có body JSON, hoặc lỗi Redis/DB.

---

## GET `/check-in/my-history`

Hội viên tự xem lịch sử check-in của chính mình.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (mọi `role`); dữ liệu luôn là của chính người gọi (ID lấy từ token), không có tham số để xem của người khác.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`. Không có giới hạn tối đa.
  - Không có bộ lọc theo ngày hay từ khóa.
- **Sắp xếp:** `checkInAt` giảm dần (lượt mới nhất trước).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy lịch sử đi tập thành công.",
    "data": [
      {
        "id": 12,
        "userId": 1,
        "checkInAt": "2026-06-24T01:30:00.000Z"
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
  - `data` là mảng bản ghi check-in thô (`id`, `userId`, `checkInAt`), không kèm thông tin user/gói tập.
  - `totalPages = ceil(total / limit)`.
- **Lỗi thường gặp:**
  - `UNAUTHORIZED` (401): Không xác định được người dùng từ token.
  - `500`: `page`/`limit` không hợp lệ.

---

## GET `/check-in/history`

Xem lịch sử check-in toàn phòng tập (phục vụ quản lý).

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
  - STAFF và ADMIN đều xem được lịch sử check-in toàn phòng tập.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`. Không có giới hạn tối đa.
  - `search` (optional): Tìm kiếm không phân biệt hoa/thường (`contains`) theo tên (`name`), email (`email`), số điện thoại (`phone`) của hội viên. Không tìm theo CCCD, không có bộ lọc theo ngày hay theo `userId`.
- **Sắp xếp:** `checkInAt` giảm dần.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy lịch sử điểm danh phòng tập thành công.",
    "data": [
      {
        "id": 12,
        "userId": 1,
        "checkInAt": "2026-06-24T01:30:00.000Z",
        "user": {
          "id": 1,
          "name": "Nguyen Van A",
          "email": "user@example.com",
          "phone": "0900000000",
          "avatarUrl": null
        }
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
  - `data` là mảng các lượt check-in kèm object `user` (`id`, `name`, `email`, `phone`, `avatarUrl`).
  - `totalPages = ceil(total / limit)`.
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Role không phải `ADMIN`/`STAFF`.
  - `500`: `page`/`limit` không hợp lệ.
