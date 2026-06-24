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
    "phone": "0900000000",
    "branchId": 1
  }
  ```
  - **Lưu ý:**
    - Với tài khoản `ADMIN`: `branchId` là **bắt buộc**. Nếu không gửi lên, hệ thống sẽ trả lỗi `400 ADMIN_MUST_SPECIFY_BRANCH`.
    - Với tài khoản `STAFF`: Hệ thống sẽ **tự động** lấy chi nhánh nơi nhân viên này đang làm việc để lưu thông tin check-in (dù STAFF có truyền `branchId` nào lên đi nữa). Nếu tài khoản STAFF chưa được gán chi nhánh trong hệ thống, trả lỗi `400 STAFF_BRANCH_REQUIRED`.

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
  - `ADMIN_MUST_SPECIFY_BRANCH` (400): ADMIN không chọn chi nhánh check-in.
  - `STAFF_BRANCH_REQUIRED` (400): STAFF chưa được thiết lập chi nhánh.
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
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF` chỉ có thể xem lịch sử check-in của những hội viên đến tập tại **chi nhánh của STAFF đó**. Nếu STAFF chưa được gán chi nhánh, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN` có thể xem lịch sử check-in toàn hệ thống và lọc theo chi nhánh bất kỳ.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`.
  - `search` (optional): Tìm kiếm theo tên (`name`), email (`email`), số điện thoại (`phone`) của hội viên.
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN có quyền sử dụng tham số này để lọc chi nhánh khác).
- **Thành công `200`:** `data` là mảng các lượt check-in kèm theo thông tin chi tiết của user và chi nhánh.
