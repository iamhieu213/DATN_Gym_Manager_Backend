# Plans API

Base path: `/plan`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Quy ước chung của module

- **Xác thực:** `authMiddleware` áp dụng cho toàn bộ route. Thiếu/sai header `Authorization: Bearer <accessToken>` hoặc token không hợp lệ/hết hạn sẽ trả về (không có trường `success`):
  - `401` `{ "error": "Unauthorized" }` — thiếu header hoặc không phải dạng `Bearer <token>`.
  - `401` `{ "error": "Invalid token" }` — token sai, hết hạn hoặc payload không hợp lệ.
- **Phân quyền:**
  - Xem danh sách / chi tiết: mọi tài khoản đã đăng nhập (xem chi tiết từng API bên dưới).
  - Tạo, sửa, mở khóa, khóa gói: chỉ `ADMIN`. `STAFF` **không** có quyền ghi ở module này (nhận `403 FORBIDDEN`), dù được xem toàn bộ danh sách gói.
- **Định dạng lỗi:** `{ "success": false, "message": "...", "error": "MÃ_LỖI" }`.

| `error` | HTTP | `message` |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. (chỉ khi token không mang `role`; thực tế bị `authMiddleware` chặn trước) |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện chức năng này. |
| `PLAN_NOT_FOUND` | 404 | Không tìm thấy thông tin gói tập này. |
| `MISSING_REQUIRED_FIELDS` | 400 | Vui lòng nhập đầy đủ các trường thông tin bắt buộc. |
| `PLAN_CODE_ALREADY_EXISTS` | 400 | Mã gói tập này đã tồn tại trên hệ thống. Vui lòng chọn mã khác. |
| `BAD_REQUEST` | 400 | ID gói tập không hợp lệ. (khi `:id` không phải số) |
| (lỗi khác, không được map) | 500 | Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau. — trường `error` chứa nội dung thông báo lỗi gốc của hệ thống thay vì một mã cố định |

Mã `PLAN_IN_USE` (400) có trong bảng map lỗi của controller nhưng **không có route nào** ném ra mã này (module không có API xóa gói).

Các lỗi trả `500` gồm: `page`/`limit` không hợp lệ, không gửi body ở API cần body, thiếu `code` khi tạo gói, dữ liệu sai kiểu (ví dụ `price` là `null`, `duration_days` không phải số nguyên) vì bị Prisma từ chối.

---

## Kiểu dữ liệu Plan

Bảng `plans`. Tên trường là snake_case. `code` là duy nhất (unique, tối đa 50 ký tự); `name` tối đa 255 ký tự. `price` là `Decimal(12,2)` nên JSON trả về dạng **chuỗi**. `features` là cột JSON, mặc định `[]` (quy ước là mảng chuỗi mô tả quyền lợi nhưng không được validate).

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

`description` có thể là `null`.

---

## GET `/plan`

Lấy danh sách các gói tập hiện có trong hệ thống (có phân trang, tìm kiếm).

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Lọc tự động:** Nếu role **không phải** `ADMIN` hoặc `STAFF` (tức `USER`, `COACH`), hệ thống **ép** `is_active = true`, chỉ trả các gói đang mở bán, bất kể client có truyền tham số `is_active` nào lên.
  - `ADMIN` và `STAFF` xem được cả gói đang mở bán lẫn đã khóa và được dùng bộ lọc `is_active`.
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số gói tập/trang, mặc định `10`. **Không có giới hạn tối đa** (không bị cap).
  - `search` (optional): Tìm kiếm không phân biệt hoa thường, chứa chuỗi trong tên (`name`) **hoặc** mô tả (`description`).
  - `is_active` (optional, chỉ có tác dụng với `ADMIN`/`STAFF`): nếu có truyền thì `"true"` → chỉ gói đang mở bán; **mọi giá trị khác** (kể cả `"false"`, `"1"`, chuỗi rỗng) → chỉ gói đã khóa. Không truyền → trả cả hai loại.
  - `page`/`limit` được đổi bằng `Number(...)` mà không validate: giá trị không phải số hoặc không hợp lệ (ví dụ `page=0`) sẽ gây lỗi `500`; `limit=0` cho `data` rỗng và `totalPages` không hợp lệ (JSON `null`).
- **Sắp xếp:** `created_at` giảm dần (mới nhất trước).
- **Thành công `200`:** `data` là mảng Plan, `meta` là phân trang.
  ```json
  {
    "success": true,
    "message": "Lấy danh sách gói tập thành công.",
    "data": [
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
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
  `meta.totalPages = ceil(total / limit)`.
- **Lỗi thường gặp:** `401` (chưa đăng nhập), `500` (`page`/`limit` không hợp lệ).

---

## GET `/plan/:id`

Xem thông tin chi tiết của một gói tập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập. **Không** lọc theo `is_active`: `USER`/`COACH` vẫn xem được chi tiết gói đã khóa nếu biết `id`.
- **Path Parameters:** `id` (number): id gói tập.
- **Thành công `200`:** `data` là đối tượng Plan chi tiết.
  ```json
  {
    "success": true,
    "message": "Lấy chi tiết gói tập thành công.",
    "data": {
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
  }
  ```
- **Lỗi thường gặp:**
  - `PLAN_NOT_FOUND` (404): Không tìm thấy gói tập.
  - `BAD_REQUEST` (400): `id` không phải số (`"ID gói tập không hợp lệ."`).

---

## POST `/plan`

Tạo mới một gói tập trong hệ thống.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
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
  - `name` (string, bắt buộc): tên gói. Chuỗi rỗng bị coi là thiếu.
  - `price` (number, bắt buộc): giá gói (VND), lưu `Decimal(12,2)`. Chỉ kiểm tra khác `undefined` (giá `0` được chấp nhận; không chặn số âm).
  - `duration_days` (number nguyên, bắt buộc): số ngày hiệu lực của gói. Chỉ kiểm tra khác `undefined`.
  - `code` (string, duy nhất): mã gói. Service **không** kiểm tra `code` có bị thiếu hay không mà chỉ kiểm tra trùng; thiếu `code` khiến bước tra cứu trùng mã lỗi và API trả `500`, nên coi như bắt buộc.
  - `description` (string, optional): mặc định `null`.
  - `features` (JSON, optional): mặc định `[]`. Khuyến nghị mảng chuỗi; không validate.
  - `is_active` (boolean, optional): mặc định `true`.
  - Các trường khác trong body bị bỏ qua.
- **Thành công `201`:** `data` là đối tượng Plan vừa tạo.
  ```json
  {
    "success": true,
    "message": "Tạo gói tập mới thành công.",
    "data": {
      "id": 1,
      "name": "Gói 1 tháng",
      "code": "PLAN_1M",
      "description": "Mô tả",
      "price": "500000",
      "duration_days": 30,
      "features": ["Tập không giới hạn"],
      "is_active": true,
      "created_at": "2026-06-01T00:00:00.000Z",
      "updated_at": "2026-06-01T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`.
  - `MISSING_REQUIRED_FIELDS` (400): Thiếu `name`, `price` hoặc `duration_days`.
  - `PLAN_CODE_ALREADY_EXISTS` (400): Mã `code` của gói tập đã tồn tại.
  - `500`: Thiếu `code`, không gửi body, hoặc dữ liệu sai kiểu.

---

## PATCH `/plan/:id`

Cập nhật thông tin của gói tập (cập nhật một phần).

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:** `id` (number): id gói tập.
- **Request Body:** Các trường cần cập nhật, tất cả đều optional; trường không gửi (hoặc `undefined`) được giữ nguyên:
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
  - Gửi `description: null` để xóa mô tả.
  - `features` được **thay thế toàn bộ** bằng giá trị gửi lên.
  - Nếu đổi `code` sang giá trị khác `code` hiện tại thì hệ thống kiểm tra trùng với gói khác.
  - Không có validate giá trị (ví dụ số âm); không đòi hỏi tối thiểu một trường. Không có hiệu ứng phụ khác (không phát sự kiện, không đụng Redis).
- **Thứ tự kiểm tra:** `id` hợp lệ (`BAD_REQUEST`) → quyền (`FORBIDDEN`) → tồn tại (`PLAN_NOT_FOUND`) → trùng `code` (`PLAN_CODE_ALREADY_EXISTS`).
- **Thành công `200`:** `data` là đối tượng Plan sau khi cập nhật.
  ```json
  {
    "success": true,
    "message": "Cập nhật thông tin gói tập thành công.",
    "data": {
      "id": 1,
      "name": "Gói 1 tháng",
      "code": "PLAN_1M",
      "description": "Mô tả",
      "price": "500000",
      "duration_days": 30,
      "features": ["Tập không giới hạn"],
      "is_active": true,
      "created_at": "2026-06-01T00:00:00.000Z",
      "updated_at": "2026-06-02T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): `id` không phải số.
  - `FORBIDDEN` (403): Không phải `ADMIN`.
  - `PLAN_NOT_FOUND` (404): Không tìm thấy gói tập.
  - `PLAN_CODE_ALREADY_EXISTS` (400): `code` mới đã thuộc gói khác.
  - `500`: Không gửi body hoặc dữ liệu sai kiểu.

---

## PATCH `/plan/:id/activate`

Mở khóa/mở bán lại gói tập (đặt `is_active = true`). Thao tác idempotent, không có body.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:** `id` (number): id gói tập.
- **Thành công `200`:** `data` là đối tượng Plan sau khi cập nhật (`is_active = true`).
  ```json
  {
    "success": true,
    "message": "Mở khóa gói tập thành công.",
    "data": {
      "id": 1,
      "name": "Gói 1 tháng",
      "code": "PLAN_1M",
      "description": "Mô tả gói tập",
      "price": "500000",
      "duration_days": 30,
      "features": ["Tập không giới hạn", "Nước uống miễn phí"],
      "is_active": true,
      "created_at": "2026-06-01T00:00:00.000Z",
      "updated_at": "2026-06-02T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:** `BAD_REQUEST` (400, `id` không phải số), `FORBIDDEN` (403), `PLAN_NOT_FOUND` (404).

---

## PATCH `/plan/:id/deactivate`

Khóa/ngừng bán gói tập (đặt `is_active = false`). Thao tác idempotent, không có body.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:** `id` (number): id gói tập.
- **Hiệu ứng:** Gói bị khóa không còn xuất hiện trong `GET /plan` với `USER`/`COACH`, và không thể mua/nâng cấp (`POST /membership/buy`, `POST /membership/upgrade` trả `PLAN_NOT_FOUND`). Các đăng ký (membership) đã tạo từ gói này không bị thay đổi.
- **Thành công `200`:** `data` là đối tượng Plan sau khi cập nhật (`is_active = false`).
  ```json
  {
    "success": true,
    "message": "Khóa gói tập thành công.",
    "data": {
      "id": 1,
      "name": "Gói 1 tháng",
      "code": "PLAN_1M",
      "description": "Mô tả gói tập",
      "price": "500000",
      "duration_days": 30,
      "features": ["Tập không giới hạn", "Nước uống miễn phí"],
      "is_active": false,
      "created_at": "2026-06-01T00:00:00.000Z",
      "updated_at": "2026-06-02T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:** `BAD_REQUEST` (400, `id` không phải số), `FORBIDDEN` (403), `PLAN_NOT_FOUND` (404).
