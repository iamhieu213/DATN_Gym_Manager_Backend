# Module 1: Auth & User Management (Xác thực & Quản lý người dùng)

Module này quản lý toàn bộ các luồng đăng ký, đăng nhập, bảo mật tài khoản và thông tin hồ sơ của toàn bộ thành viên trong hệ thống (Admin, Staff, Coach, Member).

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `users`**: Lưu trữ thông tin cốt lõi của người dùng.
*   **Bảng `refresh_tokens`**: Lưu trữ token làm mới để duy trì phiên đăng nhập.
*   **Bảng `otp_verifications`**: Lưu trữ mã xác thực OTP gửi qua email.

---

## 2. Các chức năng chính (Core Features)
*   Đăng ký tài khoản hội viên và xác thực qua mã OTP email.
*   Đăng nhập bằng Email/Password hoặc Đăng nhập nhanh qua Google OAuth.
*   Quản lý phiên làm việc (Refresh Token, Đăng xuất).
*   Đổi mật khẩu, quên mật khẩu (yêu cầu mã OTP và đổi mật khẩu mới).
*   Xem và cập nhật thông tin cá nhân (Họ tên, SĐT, Ngày sinh, Giới tính, Địa chỉ, CCCD, Liên hệ khẩn cấp).
*   Cập nhật ảnh đại diện (Tải ảnh trực tiếp lên Cloudinary từ Backend).
*   Quản trị viên (ADMIN/STAFF) quản lý danh sách người dùng (Tìm kiếm, Phân trang, CRUD thông tin, Khóa/Mở khóa tài khoản, Xóa mềm).

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. Các API Xác thực (Authentication)

#### 1. Đăng ký tài khoản (Đăng ký tạm thời)
*   **Endpoint:** `POST /api/auth/register`
*   **Quyền truy cập:** Public
*   **Mô tả:** Người dùng nhập Email, Mật khẩu, Tên để đăng ký. Hệ thống sẽ tạo OTP xác thực gửi về email.
*   **Request Body (JSON):**
    ```json
    {
      "email": "member@example.com",
      "password": "Password123",
      "name": "Nguyễn Văn A"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Mã OTP xác nhận đăng ký đã được gửi đến email của bạn.",
      "data": {
        "email": "member@example.com"
      }
    }
    ```

#### 2. Xác thực OTP hoàn tất đăng ký
*   **Endpoint:** `POST /api/auth/verify-register`
*   **Quyền truy cập:** Public
*   **Mô tả:** Nhập mã OTP đã nhận qua email để kích hoạt tài khoản chính thức.
*   **Request Body (JSON):**
    ```json
    {
      "email": "member@example.com",
      "otpCode": "123456"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Xác thực tài khoản thành công. Bạn đã có thể đăng nhập.",
      "data": {
        "id": "uuid-string-here",
        "email": "member@example.com",
        "name": "Nguyễn Văn A"
      }
    }
    ```

#### 3. Đăng nhập hệ thống (Email & Password)
*   **Endpoint:** `POST /api/auth/login`
*   **Quyền truy cập:** Public
*   **Mô tả:** Trả về Access Token (thời hạn ngắn, ví dụ 15 phút) và Refresh Token (thời hạn dài, ví dụ 7 ngày).
*   **Request Body (JSON):**
    ```json
    {
      "email": "member@example.com",
      "password": "Password123"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Đăng nhập thành công.",
      "data": {
        "accessToken": "jwt-access-token-string",
        "refreshToken": "jwt-refresh-token-string",
        "user": {
          "id": "uuid-string-here",
          "email": "member@example.com",
          "name": "Nguyễn Văn A",
          "role": "USER"
        }
      }
    }
    ```

#### 4. Làm mới Token (Refresh Token)
*   **Endpoint:** `POST /api/auth/refresh-token`
*   **Quyền truy cập:** Public
*   **Mô tả:** Sử dụng Refresh Token để lấy Access Token mới khi Access Token cũ hết hạn.
*   **Request Body (JSON):**
    ```json
    {
      "refreshToken": "jwt-refresh-token-string"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Làm mới token thành công.",
      "data": {
        "accessToken": "jwt-new-access-token"
      }
    }
    ```

#### 5. Yêu cầu mã OTP Quên mật khẩu
*   **Endpoint:** `POST /api/auth/forgot-password`
*   **Quyền truy cập:** Public
*   **Request Body (JSON):**
    ```json
    {
      "email": "member@example.com"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Mã OTP đặt lại mật khẩu đã được gửi qua email."
    }
    ```

#### 6. Đặt lại mật khẩu bằng OTP
*   **Endpoint:** `POST /api/auth/reset-password`
*   **Quyền truy cập:** Public
*   **Request Body (JSON):**
    ```json
    {
      "email": "member@example.com",
      "otpCode": "654321",
      "newPassword": "NewPassword123"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Đặt lại mật khẩu thành công. Hãy dùng mật khẩu mới để đăng nhập."
    }
    ```

---

### 3.2. Các API Người dùng tự xử lý (Personal Profile APIs)

#### 1. Xem thông tin cá nhân
*   **Endpoint:** `GET /api/users/me`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy thông tin cá nhân thành công.",
      "data": {
        "id": "uuid-user-id",
        "email": "member@example.com",
        "name": "Nguyễn Văn A",
        "phone": "0912345678",
        "avatarUrl": "https://res.cloudinary.com/...",
        "gender": "MALE",
        "citizenId": "001204001234",
        "address": "123 Đường Láng, Hà Nội",
        "emergencyContact": "Mẹ - 0987654321",
        "role": "USER",
        "status": "ACTIVE"
      }
    }
    ```

#### 2. Cập nhật thông tin cá nhân
*   **Endpoint:** `PATCH /api/users/me`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Request Body (JSON):**
    ```json
    {
      "name": "Nguyễn Văn A",
      "phone": "0912345678",
      "gender": "MALE",
      "address": "123 Đường Láng, Hà Nội",
      "emergencyContact": "Mẹ - 0987654321"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Cập nhật thông tin thành công.",
      "data": { ... }
    }
    ```

#### 3. Upload ảnh đại diện lên Cloudinary
*   **Endpoint:** `PATCH /api/users/me/avatar`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Request Body:** `multipart/form-data` chứa key file `avatar`
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Cập nhật ảnh đại diện thành công.",
      "data": {
        "avatarUrl": "https://res.cloudinary.com/..."
      }
    }
    ```

#### 4. Tự đổi mật khẩu (khi đang đăng nhập)
*   **Endpoint:** `POST /api/users/me/change-password`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Request Body (JSON):**
    ```json
    {
      "oldPassword": "Password123",
      "newPassword": "NewPassword123"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Thay đổi mật khẩu thành công."
    }
    ```

---

### 3.3. Các API Quản lý (Admin/Staff Management APIs)

#### 1. Lấy danh sách toàn bộ người dùng
*   **Endpoint:** `GET /api/users`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Query Parameters:**
    *   `page`: Số trang (mặc định 1)
    *   `limit`: Số lượng/trang (mặc định 10)
    *   `search`: Tìm theo tên, email, SĐT, CCCD
    *   `role`: Lọc theo chức vụ (`ADMIN`, `COACH`, `STAFF`, `USER`)
    *   `status`: Lọc theo trạng thái (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`)
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy danh sách người dùng thành công.",
      "data": [ ... ],
      "meta": {
        "page": 1,
        "limit": 10,
        "total": 120,
        "totalPages": 12
      }
    }
    ```

#### 2. Tạo mới tài khoản (ví dụ tạo cho Nhân viên/Coach)
*   **Endpoint:** `POST /api/users`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "email": "coach1@gym.com",
      "name": "Huấn Luyện Viên A",
      "role": "COACH"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Tạo tài khoản thành công. Thông tin đăng nhập mặc định đã được gửi qua email.",
      "data": { ... }
    }
    ```

#### 3. Xem chi tiết người dùng bất kỳ
*   **Endpoint:** `GET /api/users/:id`
*   **Quyền truy cập:** ADMIN, STAFF

#### 4. Cập nhật thông tin người dùng bất kỳ
*   **Endpoint:** `PATCH /api/users/:id`
*   **Quyền truy cập:** ADMIN, STAFF

#### 5. Khóa/Mở khóa hoặc thay đổi trạng thái tài khoản
*   **Endpoint:** `PATCH /api/users/:id/status`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):** `{ "status": "BANNED" }`

#### 6. Xóa mềm người dùng (Soft Delete)
*   **Endpoint:** `DELETE /api/users/:id`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Xóa tài khoản người dùng thành công (Trạng thái chuyển sang DELETED)."
    }
    ```

#### 7. Đặt lại mật khẩu hộ (Admin Reset Password)
*   **Endpoint:** `POST /api/users/:id/reset-password`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):** `{ "newPassword": "TemporaryPassword123" }` (không bắt buộc)
