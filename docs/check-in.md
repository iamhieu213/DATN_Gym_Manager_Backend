# Check-in API

Base path: `/check-in`

Tất cả API trong module này cần Bearer token.

---

## POST `/check-in`

Admin/staff check-in hội viên bằng số điện thoại để điểm danh vào phòng tập.

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Request Body:**
  ```json
  {
    "phone": "0900000000"
  }
  ```

- **Thành công `200`:**
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

- **Lỗi thường gặp:**
  - `USER_NOT_FOUND` (404): Số điện thoại chưa tương ứng với tài khoản nào.
  - `NO_ACTIVE_MEMBERSHIP` (400): Hội viên không có gói tập nào đang hoạt động.
  - `MEMBERSHIP_EXPIRED` (400): Gói tập của hội viên đã hết hạn.
  - `FORBIDDEN` (403): Không có quyền.

---

## GET `/check-in/my-history`

Hội viên tự xem lịch sử check-in của chính mình.

- **Quyền hạn:** Mọi hội viên đã đăng nhập.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`.

- **Thành công `200`:** `data` là mảng check-in của user, `meta` chứa thông tin phân trang.

---

## GET `/check-in/history`

Xem lịch sử check-in toàn phòng tập (phục vụ quản lý).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - STAFF và ADMIN đều xem được lịch sử check-in toàn phòng tập.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`.
  - `search` (optional): Tìm kiếm theo tên (`name`), email (`email`), số điện thoại (`phone`) của hội viên.
- **Thành công `200`:** `data` là mảng các lượt check-in kèm theo thông tin chi tiết của user.
