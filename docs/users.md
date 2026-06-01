# Users API

Base path: `/users`

Tất cả API trong module này đều cần Bearer token.

## Kiểu dữ liệu user trả về

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
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

Enum:

- `role`: `ADMIN`, `COACH`, `STAFF`, `USER`
- `status`: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`, `DELETED`
- `gender`: `MALE`, `FEMALE`, `OTHER`

## GET `/users/me`

Lấy profile user đang đăng nhập.

Trả về `200`: `data` là user object.

## PATCH `/users/me`

Cập nhật profile user đang đăng nhập.

Body:

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

Trả về `200`: `data` là user sau cập nhật.

## PATCH `/users/me/avatar`

Upload avatar.

Content-Type: `multipart/form-data`

Field file:

```text
avatar
```

Trả về `200`: `data` là user sau khi cập nhật `avatarUrl`.

## GET `/users`

Lấy danh sách user.

Quyền: `ADMIN`, `STAFF`.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10`, tối đa `100` |
| `search` | Tìm theo tên/email/phone |
| `role` | Lọc theo role |
| `status` | Lọc theo status |

Trả về `200`: `data` là mảng user, `meta` là thông tin phân trang.

## POST `/users`

Tạo user mới.

Quyền: `ADMIN`, `STAFF`. `STAFF` không được tạo `ADMIN`.

Body:

```json
{
  "email": "coach@example.com",
  "password": "GymManager@123",
  "name": "Coach A",
  "phone": "0900000001",
  "dateOfBirth": "1995-01-01",
  "role": "COACH",
  "status": "ACTIVE",
  "avatarUrl": null,
  "gender": "MALE",
  "citizenId": "001199500000",
  "address": "Ha Noi",
  "emergencyContact": "0911111111"
}
```

Trả về `201`: `data` là user mới. Nếu role là `COACH`, service tự tạo `CoachProfile`.

## GET `/users/stats`

Thống kê user dashboard.

Quyền: `ADMIN`, `STAFF`.

Trả về `200`:

```json
{
  "success": true,
  "message": "Lấy dữ liệu thống kê người dùng thành công.",
  "data": {
    "totalUsers": 100,
    "byRole": {
      "ADMIN": 1,
      "COACH": 5,
      "STAFF": 3,
      "USER": 91
    },
    "byStatus": {
      "ACTIVE": 90,
      "INACTIVE": 5,
      "SUSPENDED": 3,
      "BANNED": 2
    },
    "newRegistrations": {
      "today": 2,
      "thisMonth": 20
    }
  }
}
```

## GET `/users/:id`

Lấy chi tiết một user.

Quyền: `ADMIN`, `STAFF`.

Trả về `200`: `data` là user object.

## PATCH `/users/:id`

Cập nhật user bất kỳ.

Quyền: `ADMIN`, `STAFF`. `STAFF` không được sửa/nâng quyền tài khoản `ADMIN`.

Body:

```json
{
  "name": "New Name",
  "phone": "0900000002",
  "dateOfBirth": "1995-01-01",
  "role": "USER",
  "gender": "FEMALE",
  "citizenId": "001199500001",
  "address": "Ho Chi Minh",
  "emergencyContact": "0922222222"
}
```

Trả về `200`: `data` là user sau cập nhật.

## PATCH `/users/:id/status`

Cập nhật trạng thái tài khoản.

Quyền: `ADMIN`, `STAFF`.

Body:

```json
{
  "status": "SUSPENDED"
}
```

Trả về `200`: `data` là user sau cập nhật.

## DELETE `/users/:id`

Soft delete user, thực chất cập nhật `status = DELETED`.

Quyền: `ADMIN`, `STAFF`.

Trả về `200`: `data` là user sau cập nhật.

## POST `/users/:id/reset-password`

Reset mật khẩu user.

Quyền: `ADMIN`, `STAFF`. Nếu không truyền `newPassword`, service dùng mặc định `GymManager@123`.

Body:

```json
{
  "newPassword": "NewPassword@123"
}
```

Trả về `200`: `data` là user sau reset.

