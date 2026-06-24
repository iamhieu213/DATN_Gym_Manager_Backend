# PT Package API

Base path: `/pt-package`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Enum `TrainingGoal`

- `WEIGHT_LOSS`: Giảm cân / Giảm mỡ
- `MUSCLE_GAIN`: Tăng cơ / Thể hình
- `COMPETITION_PREP`: Huấn luyện thi đấu chuyên nghiệp
- `REHABILITATION`: Phục hồi chấn thương / Trị liệu
- `GENERAL_FITNESS`: Duy trì vóc dáng / Sức khỏe tổng quát

---

## Kiểu dữ liệu Package (Gói tập PT mẫu)

```json
{
  "id": 1,
  "name": "Combo 20 buổi",
  "code": "PT_20",
  "numberOfSessions": 20,
  "durationDays": 60,
  "goal": "MUSCLE_GAIN",
  "isActive": true,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

---

## GET `/pt-package`

Lấy danh sách các gói Combo PT mẫu có trong hệ thống.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Bảo mật trạng thái:** Nếu là hội viên (`USER`) hoặc PT (`COACH`), hệ thống sẽ **bắt buộc** chỉ lấy ra các gói đang hoạt động (`isActive = true`). `ADMIN` có thể xem toàn bộ hoặc lọc theo ý muốn.
- **Query Parameters:**
  - `goal` (optional): Lọc theo mục tiêu tập luyện (`TrainingGoal`).
  - `isActive` (optional): Lọc trạng thái hoạt động (`"true"` hoặc `"false"` - chỉ ADMIN được dùng).

- **Thành công `200`:** `data` là mảng danh sách các gói PT.

---

## GET `/pt-package/:id/coaches`

Xem danh sách các Huấn luyện viên (PT) nhận dạy gói tập này, kèm theo giá bán riêng của từng PT và lịch rảnh.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Bảo mật dữ liệu:** Nếu gói tập này đang bị khóa (`isActive = false`) và người gọi không phải `ADMIN`, hệ thống sẽ trả lỗi `404 PACKAGE_NOT_FOUND` để che giấu dữ liệu.
- **Query Parameters (Bộ lọc lịch làm việc rảnh):**
  - `dayOfWeek` (optional): Ngày trong tuần (0: Chủ Nhật, 1: Thứ 2...).
  - `startTime` (optional): Ví dụ `18:00`.
  - `endTime` (optional): Ví dụ `20:00`.
  - `slots` (optional): Lọc danh sách khung giờ dạng JSON.
- **Thành công `200`:** Trả về danh sách PT kèm giá của gói tập.

---

## POST `/pt-package`

Tạo mới một gói Combo PT mẫu trong hệ thống.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:**
  ```json
  {
    "code": "PT_20",
    "name": "Combo 20 buổi",
    "numberOfSessions": 20,
    "durationDays": 60,
    "goal": "MUSCLE_GAIN",
    "isActive": true
  }
  ```
- **Thành công `201`:** Trả về đối tượng Package vừa được tạo.
- **Lỗi thường gặp:**
  - `MISSING_REQUIRED_FIELDS` (400)
  - `PACKAGE_CODE_ALREADY_EXISTS` (400)
  - `FORBIDDEN` (403)

---

## PUT `/pt-package/:id`

Cập nhật thông tin gói Combo PT mẫu.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:** Gửi các trường thông tin cần cập nhật (tất cả là optional).
- **Thành công `200`:** Trả về đối tượng Package sau khi cập nhật.

---

## POST `/pt-package/set-price`

Admin thiết lập giá bán riêng cho từng Huấn luyện viên (PT) đối với một gói tập cụ thể.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:**
  ```json
  {
    "coachId": 1,
    "ptPackageId": 1,
    "price": 3000000
  }
  ```
- **Thành công `200`:** Trả về bản ghi giá liên kết.

---

## PATCH `/pt-package/:id/activate`

Mở hoạt động gói Combo PT mẫu toàn hệ thống.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Mở hoạt động gói PT thành công."
  }
  ```

---

## PATCH `/pt-package/:id/deactivate`

Khóa hoạt động gói Combo PT mẫu toàn hệ thống.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Khóa hoạt động gói PT thành công."
  }
  ```

---

## PATCH `/pt-package/:id/coach/:coachId/activate`

Kích hoạt lại quyền dạy gói Combo PT cụ thể cho một Huấn luyện viên (PT).

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Kích hoạt quyền dạy gói tập cho PT thành công."
  }
  ```

---

## PATCH `/pt-package/:id/coach/:coachId/deactivate`

Khóa/ngừng quyền dạy gói Combo PT cụ thể của một Huấn luyện viên (PT).

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Khóa quyền dạy gói tập của PT thành công."
  }
  ```
