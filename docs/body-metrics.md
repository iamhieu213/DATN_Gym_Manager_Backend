# Body Metrics API

Base path: `/body-metrics`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token qua Header `Authorization`.

- Thiếu header `Authorization: Bearer <token>` -> `401` với body `{ "error": "Unauthorized" }`.
- Token sai/hết hạn -> `401` với body `{ "error": "Invalid token" }`.
- Hai trường hợp trên do `authMiddleware` trả về, **không** có `success`/`message`.
- `role` của người gọi lấy từ token (`USER`, `COACH`, `STAFF`, `ADMIN`).

---

## Kiểu dữ liệu BodyMetric

```json
{
  "id": 1,
  "user_id": 4,
  "weight_kg": 72.5,
  "height_cm": 172,
  "bmi": 24.51,
  "body_fat_pct": 19.5,
  "muscle_mass_kg": 34,
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

- Tên trường của bản ghi là **snake_case** (`user_id`, `weight_kg`, `height_cm`, `body_fat_pct`, `muscle_mass_kg`, `water_pct`, `recorded_at`, `recorded_by_id`); riêng quan hệ `recordedBy` là camelCase.
- `weight_kg`, `height_cm` là số thực bắt buộc; `bmi`, `body_fat_pct`, `muscle_mass_kg`, `water_pct`, `note`, `recorded_by_id` có thể `null`.
- `recorded_at` là cột kiểu **DATE** (chỉ lưu ngày), luôn trả về dạng `YYYY-MM-DDT00:00:00.000Z`.
- `recordedBy` (`id`, `name`, `role` của người ghi nhận) **chỉ có** trong kết quả của `GET /body-metrics/history`. Response của `POST` và `PATCH` trả bản ghi thô, **không có** `recordedBy`.
- Xóa tài khoản user (xóa cứng trong DB) sẽ xóa theo các bản ghi chỉ số của user đó.

### Công thức BMI

`bmi = weight_kg / (height_cm / 100)^2`, làm tròn 2 chữ số thập phân. BMI do server tự tính, client không gửi lên.

### Mã lỗi

Response lỗi do controller trả về có dạng:

```json
{
  "success": false,
  "message": "Chỉ có hội viên mới có quyền thực hiện hành động này.",
  "error": "FORBIDDEN"
}
```

| `error` | HTTP | `message` |
| --- | --- | --- |
| `UNAUTHORIZED` | `401` | Bạn chưa đăng nhập hoặc phiên đã hết hạn. |
| `FORBIDDEN` | `403` | Chỉ có hội viên mới có quyền thực hiện hành động này. (dùng cho cả trường hợp hội viên sửa/xóa bản ghi không phải của mình) |
| `METRIC_NOT_FOUND` | `404` | Không tìm thấy dữ liệu chỉ số cơ thể. |
| `MISSING_REQUIRED_FIELDS` | `400` | Vui lòng nhập cân nặng và chiều cao. |
| (lỗi khác) | `500` | Đã xảy ra lỗi hệ thống. |

Lưu ý chung:
- Một số lỗi `400` được controller trả trực tiếp và **không có** trường `error`, dạng `{ "success": false, "message": "..." }` (xem từng endpoint).
- Với lỗi `500`, trường `error` chứa nguyên văn `message` của exception (ví dụ `Cannot read properties of undefined (reading 'weight_kg')`).
- Module **không validate** kiểu/khoảng giá trị của body và query ngoài các kiểm tra được nêu ở từng endpoint. Giá trị sai kiểu hoặc không parse được (số dạng chuỗi, ngày sai định dạng, `page`/`limit` không phải số...) được chuyển thẳng xuống Prisma và thường trả `500`.
- Các endpoint `POST`/`PATCH` cần gửi `Content-Type: application/json`. Không có body JSON thì `req.body` là `undefined` và request trả `500`.
- Không có endpoint xem chi tiết một bản ghi (`GET /body-metrics/:id`).

---

## GET `/body-metrics/history`

Lấy danh sách lịch sử đo chỉ số cơ thể của hội viên để hiển thị hoặc vẽ biểu đồ tiến trình.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Hội viên (`USER`)**: Chỉ lấy được lịch sử của **chính mình** (ID lấy từ Token). Tham số `userId` (nếu có) bị **bỏ qua hoàn toàn**, hội viên không thể xem của người khác và cũng không nhận lỗi `403` khi truyền `userId` khác.
  - **`ADMIN` / `STAFF` / `COACH`**: Xem lịch sử của **bất kỳ user nào** bằng query `userId`. Không có ràng buộc "HLV chỉ xem hội viên được phân công", và API không kiểm tra user có tồn tại hay không (user không tồn tại/không có dữ liệu -> mảng rỗng, `total = 0`).
- **Query Parameters:**
  - `userId` (bắt buộc với `ADMIN`/`STAFF`/`COACH`, bỏ qua với `USER`): ID (số nguyên) của user cần xem lịch sử. Đọc bằng `parseInt`.
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi mỗi trang, mặc định `10`. **Không có giới hạn tối đa** (không có `MAX_LIMIT`).
  - `startDate` (optional): Lọc từ ngày, bao gồm chính ngày đó (`recorded_at >= startDate`). Định dạng `YYYY-MM-DD`.
  - `endDate` (optional): Lọc đến ngày, bao gồm chính ngày đó (`recorded_at <= endDate`). Định dạng `YYYY-MM-DD`.
  - `page`/`limit`/`startDate`/`endDate` không được validate: giá trị không hợp lệ (ví dụ `page=abc`, `startDate=abc`) gây lỗi `500`. `startDate=`/`endDate=` rỗng bị bỏ qua.
- **Sắp xếp:** `recorded_at` giảm dần (bản ghi mới nhất trước).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy lịch sử thành công.",
    "data": [
      {
        "id": 1,
        "user_id": 4,
        "weight_kg": 72.5,
        "height_cm": 172,
        "bmi": 24.51,
        "body_fat_pct": 19.5,
        "muscle_mass_kg": 34,
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
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
  - `totalPages = ceil(total / limit)`.
- **Lỗi thường gặp:**
  - `400` (không có trường `error`), chỉ với `ADMIN`/`STAFF`/`COACH`:
    - Thiếu `userId`: `{ "success": false, "message": "Vui lòng cung cấp ID của hội viên cần xem lịch sử qua query parameter (?userId=xxx)." }`
    - `userId` không phải số: `{ "success": false, "message": "ID người dùng không hợp lệ." }`
  - `UNAUTHORIZED` (401): Không xác định được người dùng từ Token.
  - `500`: `page`/`limit`/`startDate`/`endDate` sai định dạng.

---

## POST `/body-metrics`

Thêm mới một bản ghi chỉ số cơ thể.

- **Quyền hạn:** Chỉ dành riêng cho **Hội viên (`USER`)** tự ghi nhận chỉ số cho chính mình. `ADMIN`, `STAFF`, `COACH` đều nhận `403 FORBIDDEN` (kiểm tra quyền chạy trước khi đọc body).
- **Đặc điểm:** Hệ thống **tự động tính BMI** từ `weight_kg` và `height_cm`, đồng thời tự điền `user_id` và `recorded_by_id` bằng ID của hội viên đăng nhập (luôn bằng nhau). Client không thể chỉ định `user_id`/`recorded_by_id`/`bmi` (bị bỏ qua nếu gửi lên).
- **Request Body:**
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

  | Trường | Bắt buộc | Kiểu | Quy tắc |
  | --- | --- | --- | --- |
  | `weight_kg` | Có | number | Thiếu hoặc bằng `0` -> `MISSING_REQUIRED_FIELDS`. Không kiểm tra khoảng giá trị (giá trị âm vẫn được nhận). |
  | `height_cm` | Có | number | Thiếu hoặc bằng `0` -> `MISSING_REQUIRED_FIELDS`. Không kiểm tra khoảng giá trị. |
  | `body_fat_pct` | Không | number | Tỉ lệ mỡ (%). Không gửi -> `null`. Không kiểm tra khoảng giá trị. |
  | `muscle_mass_kg` | Không | number | Khối lượng cơ (kg). Không gửi -> `null`. |
  | `water_pct` | Không | number | Tỉ lệ nước (%). Không gửi -> `null`. |
  | `note` | Không | string | Ghi chú (kiểu Text). Không gửi -> `null`. |
  | `recorded_at` | Không | string `YYYY-MM-DD` | Ngày đo. Mặc định là ngày hiện tại. Cột chỉ lưu phần ngày. Chuỗi không parse được -> `500`. |

  - Không giới hạn số bản ghi mỗi ngày (có thể tạo nhiều bản ghi cùng ngày).
- **Thành công `201`:**
  ```json
  {
    "success": true,
    "message": "Thêm chỉ số thành công.",
    "data": {
      "id": 1,
      "user_id": 4,
      "weight_kg": 72.5,
      "height_cm": 172,
      "bmi": 24.51,
      "body_fat_pct": 19.5,
      "muscle_mass_kg": 34,
      "water_pct": 56.5,
      "note": "Cân đo đầu ngày bằng cân thông minh Xiaomi.",
      "recorded_at": "2026-06-28T00:00:00.000Z",
      "recorded_by_id": 4
    }
  }
  ```
  - `data` là bản ghi vừa tạo, kèm `bmi`, **không** có `recordedBy`.
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Tài khoản đăng nhập không phải Hội viên (Ví dụ: Admin/Staff/PT gọi API này).
  - `MISSING_REQUIRED_FIELDS` (400): Thiếu (hoặc bằng `0`) cân nặng `weight_kg` hoặc chiều cao `height_cm`.
  - `500`: không có body JSON, hoặc giá trị sai kiểu (ví dụ số gửi dạng chuỗi), ngày sai định dạng.

---

## PATCH `/body-metrics/:id`

Cập nhật một bản ghi chỉ số cơ thể đã đo trong quá khứ.

- **Quyền hạn:** Chỉ **Hội viên (`USER`) sở hữu bản ghi đó** (`user_id` = ID trong Token). `ADMIN`, `STAFF`, `COACH` luôn nhận `403 FORBIDDEN`.
- **Path Parameters:** `id` (số nguyên): ID bản ghi chỉ số. Không parse được thành số -> `400` `{ "success": false, "message": "ID không hợp lệ." }` (không có trường `error`).
- **Thứ tự kiểm tra:** role `USER` (`FORBIDDEN`) -> `id` hợp lệ (`400`) -> bản ghi tồn tại (`METRIC_NOT_FOUND`) -> đúng chủ sở hữu (`FORBIDDEN`).
- **Đặc điểm:** Nếu body có `weight_kg` **hoặc** `height_cm`, hệ thống **tự tính lại BMI**: trường không gửi lấy giá trị hiện tại của bản ghi. Nếu chỉ sửa các trường khác thì BMI giữ nguyên. Không thể đổi `user_id`/`recorded_by_id` (bị bỏ qua). Lưu ý: nếu body có `bmi` mà **không** có `weight_kg`/`height_cm`, giá trị `bmi` do client gửi sẽ được ghi thẳng vào DB (code không loại bỏ trường này); nếu có `weight_kg`/`height_cm` thì `bmi` luôn bị ghi đè bằng giá trị server tính.
- **Request Body:** Các trường cần cập nhật (tất cả đều tùy chọn, chỉ trường khác `undefined` mới được cập nhật; kiểu/giải thích như `POST /body-metrics`).
  ```json
  {
    "weight_kg": 71.0,
    "note": "Cập nhật lại cân nặng thực tế sau khi hiệu chuẩn lại cân."
  }
  ```
  - Trường hợp cập nhật **không** kiểm tra `weight_kg`/`height_cm` khác `0` như khi tạo mới.
  - Gửi `null` cho `body_fat_pct`, `muscle_mass_kg`, `water_pct`, `note` sẽ xóa giá trị (đặt về `null`).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Cập nhật thành công.",
    "data": {
      "id": 1,
      "user_id": 4,
      "weight_kg": 71,
      "height_cm": 172,
      "bmi": 24,
      "body_fat_pct": 19.5,
      "muscle_mass_kg": 34,
      "water_pct": 56.5,
      "note": "Cập nhật lại cân nặng thực tế sau khi hiệu chuẩn lại cân.",
      "recorded_at": "2026-06-28T00:00:00.000Z",
      "recorded_by_id": 4
    }
  }
  ```
  - `data` là bản ghi sau cập nhật, **không** có `recordedBy`.
- **Lỗi thường gặp:**
  - `400` (không có `error`): `ID không hợp lệ.`
  - `METRIC_NOT_FOUND` (404): Không tìm thấy bản ghi đo với ID tương ứng.
  - `FORBIDDEN` (403): Tài khoản đăng nhập không phải Hội viên, hoặc không phải chủ sở hữu bản ghi đo này (cùng một message).
  - `500`: không có body JSON, hoặc giá trị sai kiểu/định dạng.

---

## DELETE `/body-metrics/:id`

Xóa một bản ghi chỉ số cơ thể.

- **Quyền hạn:** Chỉ **Hội viên (`USER`) sở hữu bản ghi đó** mới được quyền xóa. `ADMIN`, `STAFF`, `COACH` luôn nhận `403 FORBIDDEN`.
- **Path Parameters:** `id` (số nguyên): ID bản ghi chỉ số. Không parse được thành số -> `400` `{ "success": false, "message": "ID không hợp lệ." }` (không có trường `error`).
- **Thứ tự kiểm tra:** giống `PATCH /body-metrics/:id`.
- **Hành vi:** Xóa cứng bản ghi khỏi DB (không có soft delete).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Xóa thành công."
  }
  ```
  - Không có trường `data`.
- **Lỗi thường gặp:**
  - `400` (không có `error`): `ID không hợp lệ.`
  - `METRIC_NOT_FOUND` (404)
  - `FORBIDDEN` (403)
