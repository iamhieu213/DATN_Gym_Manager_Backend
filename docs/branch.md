# Branch API

Base path: `/branch`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

## Kiểu dữ liệu Branch (GymBranch)

```json
{
  "id": 1,
  "name": "Gym Center Quận 1",
  "code": "CN_Q1",
  "address": "123 Nguyễn Huệ, Quận 1",
  "phone": "0281234567",
  "isActive": true,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

---

## GET `/branch`

Lấy danh sách các chi nhánh.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (`ADMIN`, `STAFF`, `COACH`, `USER`).
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định là `1`.
  - `limit` (optional): Số lượng chi nhánh mỗi trang, mặc định là `10`.
  - `search` (optional): Từ khóa tìm kiếm (tìm theo `name`, `code`, `address`).
  - `isActive` (optional): Lọc theo trạng thái hoạt động (`"true"` hoặc `"false"`).

- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách chi nhánh thành công.",
    "data": [
      {
        "id": 1,
        "name": "Gym Center Quận 1",
        "code": "CN_Q1",
        "address": "123 Nguyễn Huệ, Quận 1",
        "phone": "0281234567",
        "isActive": true,
        "createdAt": "2026-06-01T00:00:00.000Z",
        "updatedAt": "2026-06-01T00:00:00.000Z"
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

---

## GET `/branch/:id`

Xem chi tiết thông tin một chi nhánh theo ID.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy thông tin chi nhánh thành công.",
    "data": {
      "id": 1,
      "name": "Gym Center Quận 1",
      "code": "CN_Q1",
      "address": "123 Nguyễn Huệ, Quận 1",
      "phone": "0281234567",
      "isActive": true,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-01T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `BRANCH_NOT_FOUND` (404): Không tìm thấy chi nhánh với ID đã cho.
  - `BAD_REQUEST` (400): ID không hợp lệ.

---

## POST `/branch`

Tạo mới một chi nhánh phòng tập.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:**
  ```json
  {
    "name": "Gym Center Quận 2",
    "code": "CN_Q2",
    "address": "456 Mai Chí Thọ, Quận 2",
    "phone": "0287654321",
    "isActive": true
  }
  ```
- **Thành công `201`:**
  ```json
  {
    "success": true,
    "message": "Tạo chi nhánh mới thành công.",
    "data": {
      "id": 2,
      "name": "Gym Center Quận 2",
      "code": "CN_Q2",
      "address": "456 Mai Chí Thọ, Quận 2",
      "phone": "0287654321",
      "isActive": true,
      "createdAt": "2026-06-24T13:00:00.000Z",
      "updatedAt": "2026-06-24T13:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `MISSING_REQUIRED_FIELDS` (400): Thiếu các trường bắt buộc (`name`, `code`, `address`).
  - `BRANCH_CODE_ALREADY_EXISTS` (400): Mã chi nhánh đã được đăng ký.
  - `FORBIDDEN` (403): Không phải tài khoản `ADMIN`.

---

## PATCH `/branch/:id`

Cập nhật thông tin chi nhánh.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:** Gửi các trường cần cập nhật (tất cả đều là optional).
  ```json
  {
    "name": "Gym Center Quận 2 Cập Nhật",
    "phone": "0988888888"
  }
  ```
- **Thành công `200`:** Trả về dữ liệu chi nhánh sau khi cập nhật.
- **Lỗi thường gặp:**
  - `BRANCH_NOT_FOUND` (404)
  - `BRANCH_CODE_ALREADY_EXISTS` (400)
  - `FORBIDDEN` (403)

---

## PATCH `/branch/:id/activate`

Kích hoạt hoạt động cho chi nhánh.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Kích hoạt chi nhánh thành công.",
    "data": {
      "id": 2,
      "isActive": true,
      "name": "Gym Center Quận 2",
      "code": "CN_Q2",
      "address": "456 Mai Chí Thọ, Quận 2",
      "phone": "0287654321"
    }
  }
  ```

---

## PATCH `/branch/:id/deactivate`

Tạm ngưng hoạt động cho chi nhánh.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Tạm ngưng hoạt động chi nhánh thành công.",
    "data": {
      "id": 2,
      "isActive": false,
      "name": "Gym Center Quận 2",
      "code": "CN_Q2",
      "address": "456 Mai Chí Thọ, Quận 2",
      "phone": "0287654321"
    }
  }
  ```
