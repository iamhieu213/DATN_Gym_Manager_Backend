# Plans API

Base path: `/plan`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Kiểu dữ liệu Plan

```json
{
  "id": 1,
  "name": "Gói 1 tháng",
  "code": "PLAN_1M",
  "description": "Mô tả gói tập",
  "price": "500000",
  "duration_days": 30,
  "features": ["Tập không giới hạn", "Nước uống miễn phí"],
  "is_active": true,
  "created_at": "2026-06-01T00:00:00.000Z",
  "updated_at": "2026-06-01T00:00:00.000Z"
}
```

---

## GET `/plan`

Lấy danh sách các gói tập hiện có trong hệ thống.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Lọc tự động:** Nếu tài khoản đăng nhập là Hội viên (`USER`) hoặc PT (`COACH`), hệ thống sẽ **bắt buộc** chỉ trả về các gói tập đang mở bán (`is_active = true`), bất kể client có truyền tham số `is_active` nào lên.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số lượng gói tập/trang, mặc định `10`.
  - `search` (optional): Tìm kiếm theo tên (`name`) hoặc mô tả (`description`).
  - `is_active` (optional): Lọc theo trạng thái hoạt động (`"true"` hoặc `"false"` - chỉ có tác dụng với `ADMIN` và `STAFF`).

- **Thành công `200`:** `data` là mảng danh sách các gói tập, `meta` là phân trang.

---

## GET `/plan/:id`

Xem thông tin chi tiết của một gói tập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Thành công `200`:** `data` là đối tượng Plan chi tiết.
- **Lỗi thường gặp:**
  - `PLAN_NOT_FOUND` (404): Không tìm thấy gói tập.
  - `BAD_REQUEST` (400): ID không hợp lệ.

---

## POST `/plan`

Tạo mới một gói tập trong hệ thống.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:**
  ```json
  {
    "name": "Gói 1 tháng",
    "code": "PLAN_1M",
    "description": "Mô tả",
    "price": 500000,
    "duration_days": 30,
    "features": ["Tập không giới hạn"],
    "is_active": true
  }
  ```
- **Thành công `201`:** Trả về đối tượng Plan vừa được tạo.
- **Lỗi thường gặp:**
  - `MISSING_REQUIRED_FIELDS` (400): Thiếu các trường bắt buộc (`name`, `price`, `duration_days`).
  - `PLAN_CODE_ALREADY_EXISTS` (400): Mã code của gói tập đã tồn tại.
  - `FORBIDDEN` (403): Không phải ADMIN.

---

## PATCH `/plan/:id`

Cập nhật thông tin của gói tập.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:** Các trường cần cập nhật (tất cả là optional).
- **Thành công `200`:** Trả về đối tượng Plan sau khi cập nhật.
- **Lỗi thường gặp:**
  - `PLAN_NOT_FOUND` (404)
  - `PLAN_CODE_ALREADY_EXISTS` (400)
  - `FORBIDDEN` (403)

---

## PATCH `/plan/:id/activate`

Mở bán lại gói tập (đặt `is_active = true`).

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Kích hoạt gói tập thành công.",
    "data": { ... }
  }
  ```

---

## PATCH `/plan/:id/deactivate`

Khóa/ngừng bán gói tập (đặt `is_active = false`).

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Tạm ngưng gói tập thành công.",
    "data": { ... }
  }
  ```
