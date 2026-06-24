# Coach API

Base path: `/coach`

---

## Kiểu dữ liệu chính

Coach profile lấy từ bảng `coach_profiles`, thường kèm user, lịch rảnh, packages tùy theo endpoint:

```json
{
  "id": 1,
  "userId": 2,
  "speciality": "Muscle Gain",
  "bio": "PT 5 năm kinh nghiệm",
  "isAvailable": true,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

---

## GET `/coach`

Lấy danh sách PT (Huấn luyện viên cá nhân) public đang mở hoạt động nhận khách.

- **Quyền hạn:** Không yêu cầu đăng nhập.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`.
  - `search` (optional): Tìm kiếm theo tên của PT.
  - `branchId` (optional): Lọc PT thuộc một chi nhánh phòng tập cụ thể.
  - `goal` (optional): Lọc theo mục tiêu huấn luyện: `WEIGHT_LOSS`, `MUSCLE_GAIN`, `COMPETITION_PREP`, `REHABILITATION`, `GENERAL_FITNESS`.
  - `ptPackageId` (optional): Lọc các PT đang dạy gói Combo này.
  - `dayOfWeek` (optional): Ngày trong tuần (0: Chủ Nhật, 1: Thứ 2, ..., 6: Thứ 7).
  - `startTime` (optional): Giờ bắt đầu, ví dụ `18:00`.
  - `endTime` (optional): Giờ kết thúc, ví dụ `20:00`.
  - `slots` (optional): Mảng JSON string chứa các khung giờ cần lọc, ví dụ: `[{"dayOfWeek":1,"startTime":"18:00","endTime":"20:00"}]`.

- **Thành công `200`:** `data` là mảng các coach profiles kèm theo thông tin chi tiết user và chi nhánh.

---

## GET `/coach/:id`

Lấy thông tin chi tiết của một PT theo `CoachProfile.id`.

- **Quyền hạn:** Không yêu cầu đăng nhập.
- **Thành công `200`:** `data` là chi tiết coach profile.

---

## GET `/coach/profile/me`

PT tự xem hồ sơ cá nhân của mình.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`.
- **Thành công `200`:** `data` là hồ sơ của coach đang đăng nhập.

---

## PUT `/coach/profile`

PT cập nhật hồ sơ cá nhân của mình.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`.
- **Request Body:**
  ```json
  {
    "speciality": "Muscle Gain",
    "bio": "PT 5 năm kinh nghiệm"
  }
  ```
- **Thành công `200`:** `data` là hồ sơ của coach sau khi cập nhật.

---

## GET `/coach/availability/me`

PT xem lịch rảnh hàng tuần của mình.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`.
- **Thành công `200`:** `data` là danh sách các khung giờ rảnh được đăng ký.

---

## PUT `/coach/availability`

PT cập nhật lịch rảnh hàng tuần của mình để hội viên có thể đặt lịch.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`.
- **Request Body:**
  ```json
  {
    "availabilities": [
      {
        "dayOfWeek": 1,
        "startTime": "18:00",
        "endTime": "20:00"
      }
    ]
  }
  ```
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Cập nhật lịch làm việc rảnh thành công."
  }
  ```

---

## GET `/coach/admin/list`

Ban quản trị xem danh sách toàn bộ PT trong hệ thống (bao gồm cả PT đang không hoạt động).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF` chỉ được xem danh sách PT thuộc **chi nhánh của STAFF đó**. Nếu STAFF chưa được gán chi nhánh, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN` xem được tất cả các PT trên toàn hệ thống.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`.
  - `search` (optional): Tìm kiếm theo tên của PT.
  - `isAvailable` (optional): Lọc theo trạng thái sẵn sàng nhận khách (`true` hoặc `false`).
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN có quyền sử dụng tham số này để lọc chi nhánh khác).

- **Thành công `200`:** `data` là mảng danh sách PT, `meta` là phân trang.

---

## PATCH `/coach/admin/:id/status`

Admin thay đổi trạng thái hoạt động/nhận khách của PT.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Path Param `id`:** `CoachProfile.id` cần cập nhật.
- **Request Body:**
  ```json
  {
    "isAvailable": true
  }
  ```
- **Thành công `200`:** `data` là coach profile sau khi cập nhật.
