# Users API

Base path: `/users`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Kiểu dữ liệu User trả về

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Nguyen Van A",
  "phone": "0900000000",
  "dateOfBirth": "2000-01-01T00:00:00.000Z",
  "role": "USER",
  "status": "ACTIVE",
  "avatarUrl": null,
  "gender": "MALE",
  "citizenId": null,
  "address": null,
  "emergencyContact": null,
  "branchId": 1,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

### Các Enum liên quan
- **`role`:** `ADMIN` (Quản trị hệ thống), `COACH` (Huấn luyện viên/PT), `STAFF` (Nhân viên/Lễ tân), `USER` (Hội viên).
- **`status`:** `ACTIVE`, `INACTIVE`, `SUSPENDED` (Tạm ngưng), `BANNED` (Bị cấm), `DELETED` (Đã xóa mềm).
- **`gender`:** `MALE`, `FEMALE`, `OTHER`.

---

## GET `/users/me`

Lấy thông tin tài khoản cá nhân của người dùng đang đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Thành công `200`:** `data` là đối tượng User.

---

## PATCH `/users/me`

Cập nhật thông tin cá nhân của người dùng đang đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Request Body:** Các trường thông tin cơ bản:
  ```json
  {
    "name": "Nguyen Van A",
    "phone": "0900000000",
    "dateOfBirth": "2000-01-01",
    "gender": "MALE",
    "citizenId": "001200000000",
    "address": "Ha Noi",
    "emergencyContact": "0911111111"
  }
  ```
- **Thành công `200`:** Trả về đối tượng User sau khi cập nhật.
- **Lỗi thường gặp:**
  - `PHONE_ALREADY_EXISTS` (409): Số điện thoại trùng với tài khoản khác.
  - `CITIZEN_ID_ALREADY_EXISTS` (409): CCCD/CMND trùng với tài khoản khác.

---

## PATCH `/users/me/avatar`

Cập nhật ảnh đại diện của người dùng (tải lên thông qua Cloudinary).

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Content-Type:** `multipart/form-data`
- **Field file:** `avatar` (tên trường chứa file ảnh tải lên).
- **Thành công `200`:** Trả về đối tượng User với `avatarUrl` mới.

---

## GET `/users`

Ban quản trị xem danh sách toàn bộ người dùng trong hệ thống (có hỗ trợ tìm kiếm, lọc và phân trang).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF` chỉ có thể xem danh sách người dùng thuộc **chi nhánh của STAFF đó**. Nếu STAFF chưa được gán chi nhánh trong hệ thống, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN` xem được tất cả người dùng và lọc theo chi nhánh bất kỳ.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`.
  - `search` (optional): Tìm kiếm theo tên (`name`), email, số điện thoại (`phone`).
  - `role` (optional): Lọc theo vai trò (`ADMIN`, `STAFF`, `COACH`, `USER`).
  - `status` (optional): Lọc theo trạng thái.
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN).

- **Thành công `200`:** Trả về mảng danh sách người dùng và meta phân trang.

---

## POST `/users`

Ban quản trị tạo trực tiếp tài khoản mới (ví dụ tạo tài khoản cho nhân viên mới, huấn luyện viên mới).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Ràng buộc an toàn & chi nhánh:**
    - Nếu tài khoản được tạo có role là **`STAFF`** hoặc **`COACH`**: Bắt buộc phải truyền `branchId` trong body, nếu không trả lỗi `400 BRANCH_REQUIRED_FOR_STAFF_COACH`.
    - STAFF không thể tạo tài khoản có role `ADMIN` (trả lỗi `403 FORBIDDEN`).
- **Request Body:**
  ```json
  {
    "email": "staff@example.com",
    "password": "GymManager@123",
    "name": "Nguyen Van B",
    "phone": "0912345678",
    "role": "STAFF",
    "branchId": 1
  }
  ```
  - **Lưu ý:** Nếu không truyền mật khẩu `password`, hệ thống tự đặt mật khẩu mặc định là `GymManager@123`.
- **Thành công `201`:** Trả về tài khoản User mới được tạo.

---

## GET `/users/stats`

Lấy thống kê số lượng tài khoản theo từng nhóm vai trò và trạng thái (phục vụ biểu đồ quản trị).

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ xem thống kê của chi nhánh mình).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "data": {
      "totalUsers": 100,
      "byRole": { "ADMIN": 1, "COACH": 5, "STAFF": 3, "USER": 91 },
      "byStatus": { "ACTIVE": 90, "INACTIVE": 5, "SUSPENDED": 3, "BANNED": 2 },
      "newRegistrations": { "today": 2, "thisMonth": 20 }
    }
  }
  ```

---

## GET `/users/:id`

Xem chi tiết thông tin một người dùng bất kỳ.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ xem được người dùng thuộc chi nhánh của mình).
- **Thành công `200`:** Trả về thông tin User.

---

## PATCH `/users/:id`

Cập nhật thông tin của một người dùng bất kỳ.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Ràng buộc bảo mật của STAFF:**
    - STAFF không thể chỉnh sửa thông tin tài khoản của `ADMIN` (trả lỗi `403 FORBIDDEN`).
    - STAFF không thể thay đổi trường `branchId` của người khác (trả lỗi `403 FORBIDDEN`).
    - STAFF không thể thay đổi/nâng cấp vai trò (`role`) của bất kỳ tài khoản nào lên thành `ADMIN` (trả lỗi `403 FORBIDDEN`).
    - Nếu đổi vai trò của người khác thành `STAFF` hoặc `COACH`, vẫn bắt buộc phải có `branchId`.
- **Request Body:** Gửi các trường thông tin cần sửa.
- **Thành công `200`:** Trả về đối tượng User sau cập nhật.

---

## PATCH `/users/:id/status`

Thay đổi trạng thái hoạt động của một tài khoản.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF không được thay đổi trạng thái của tài khoản `ADMIN`).
- **Request Body:**
  ```json
  {
    "status": "SUSPENDED"
  }
  ```
- **Thành công `200`:** Trả về đối tượng User sau cập nhật.

---

## DELETE `/users/:id`

Xóa mềm tài khoản người dùng khỏi hệ thống (thiết lập trạng thái `status = DELETED`).

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF không được xóa tài khoản của `ADMIN`).
- **Thành công `200`:** Trả về đối tượng User sau khi cập nhật status sang DELETED.

---

## POST `/users/:id/reset-password`

Đặt lại mật khẩu cho một tài khoản người dùng về mặc định hoặc một mật khẩu mới.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF không được reset mật khẩu cho tài khoản `ADMIN`).
- **Request Body:**
  ```json
  {
    "newPassword": "NewPassword@123"
  }
  ```
  - **Lưu ý:** Nếu không truyền mật khẩu mới `newPassword`, hệ thống tự đặt mật khẩu mặc định là `GymManager@123`.
- **Thành công `200`:** Trả về thông tin User.
