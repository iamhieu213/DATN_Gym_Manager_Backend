# Body Metrics API

Base path: `/body-metrics`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token qua Header `Authorization`.

---

## Kiểu dữ liệu BodyMetric

```json
{
  "id": 1,
  "user_id": 4,
  "weight_kg": 72.5,
  "height_cm": 172.0,
  "bmi": 24.51,
  "body_fat_pct": 19.5,
  "muscle_mass_kg": 34.0,
  "water_pct": 56.5,
  "note": "Cân đo đầu ngày bằng cân thông minh Xiaomi.",
  "recorded_at": "2026-06-28T00:00:00.000Z",
  "recorded_by_id": 4,
  "recordedBy": {
    "id": 4,
    "name": "Trần Văn An",
    "role": "USER"
  }
}
```

---

## GET `/body-metrics/history`

Lấy danh sách lịch sử đo chỉ số cơ thể của hội viên để hiển thị hoặc vẽ biểu đồ tiến trình.

* **Quyền hạn**:
  * **Hội viên (`USER`)**: Chỉ lấy được lịch sử của **chính mình** (Hệ thống tự động lấy ID từ Token, không cần truyền tham số).
  * **Admin / PT (Coach) / Staff**: Có thể xem lịch sử của **bất kỳ hội viên nào** bằng cách truyền target ID qua query parameter.
* **Query Parameters**:
  * `userId` (Bắt buộc đối với Admin/PT/Staff, bỏ qua đối với Hội viên): ID của hội viên cần xem lịch sử.
  * `page` (Tùy chọn): Trang hiện tại, mặc định là `1`.
  * `limit` (Tùy chọn): Số lượng bản ghi mỗi trang, mặc định là `10`.
  * `startDate` (Tùy chọn): Lọc từ ngày (Định dạng: `YYYY-MM-DD`).
  * `endDate` (Tùy chọn): Lọc đến ngày (Định dạng: `YYYY-MM-DD`).

* **Thành công `200`**:
  ```json
  {
    "success": true,
    "message": "Lấy lịch sử thành công.",
    "data": [ ... ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
* **Lỗi thường gặp**:
  * `UNAUTHORIZED` (401): Chưa đăng nhập hoặc Token hết hạn.
  * `FORBIDDEN` (403): Hội viên thông thường cố gắng xem lịch sử của người khác.

---

## POST `/body-metrics`

Thêm mới một bản ghi chỉ số cơ thể.

* **Quyền hạn**: Chỉ dành riêng cho **Hội viên (`USER`)** tự ghi nhận chỉ số cho chính mình.
* **Đặc điểm**: Hệ thống sẽ **tự động tính toán chỉ số BMI** dựa trên `weight_kg` và `height_cm` truyền lên, đồng thời tự động điền `user_id` và `recorded_by_id` từ Token của Hội viên đăng nhập.
* **Request Body**:
  ```json
  {
    "weight_kg": 72.5,
    "height_cm": 172,
    "body_fat_pct": 19.5,
    "muscle_mass_kg": 34.0,
    "water_pct": 56.5,
    "note": "Cân đo đầu ngày bằng cân thông minh Xiaomi.",
    "recorded_at": "2026-06-28"
  }
  ```
* **Thành công `201`**: Trả về dữ liệu chỉ số cơ thể vừa được tạo thành công kèm chỉ số BMI.
* **Lỗi thường gặp**:
  * `MISSING_REQUIRED_FIELDS` (400): Thiếu cân nặng (`weight_kg`) hoặc chiều cao (`height_cm`).
  * `FORBIDDEN` (403): Tài khoản đăng nhập không phải là Hội viên (Ví dụ: Admin/PT gọi API này).

---

## PATCH `/body-metrics/:id`

Cập nhật một bản ghi chỉ số cơ thể đã đo trong quá khứ.

* **Quyền hạn**: Chỉ **Hội viên sở hữu bản ghi đó** mới được quyền cập nhật.
* **Đặc điểm**: Nếu cập nhật cân nặng (`weight_kg`) hoặc chiều cao (`height_cm`), hệ thống sẽ **tự động tính toán lại chỉ số BMI** mới.
* **Request Body**: Các trường cần cập nhật (tất cả đều là tùy chọn).
  ```json
  {
    "weight_kg": 71.0,
    "note": "Cập nhật lại cân nặng thực tế sau khi hiệu chuẩn lại cân."
  }
  ```
* **Thành công `200`**: Trả về dữ liệu chỉ số cơ thể sau khi được cập nhật.
* **Lỗi thường gặp**:
  * `METRIC_NOT_FOUND` (404): Không tìm thấy bản ghi đo với ID tương ứng.
  * `FORBIDDEN` (403): Tài khoản đăng nhập không phải Hội viên sở hữu bản ghi đo này.

---

## DELETE `/body-metrics/:id`

Xóa một bản ghi chỉ số cơ thể.

* **Quyền hạn**: Chỉ **Hội viên sở hữu bản ghi đó** mới được quyền xóa.
* **Thành công `200`**:
  ```json
  {
    "success": true,
    "message": "Xóa thành công."
  }
  ```
* **Lỗi thường gặp**:
  * `METRIC_NOT_FOUND` (404)
  * `FORBIDDEN` (403)
