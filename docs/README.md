# Gym Backend API Docs

Tài liệu này được tạo theo code hiện tại trong `src/app.ts` và các route/controller/service trong `src/modules`.

Base URL khi chạy local thường là:

```text
http://localhost:<PORT>
```

Các API có `authMiddleware` yêu cầu header:

```http
Authorization: Bearer <accessToken>
```

Response JSON phổ biến:

```json
{
  "success": true,
  "message": "Thông báo kết quả",
  "data": {}
}
```

Khi có phân trang, response thêm `meta`:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  }
}
```

Khi lỗi, response thường là:

```json
{
  "success": false,
  "message": "Thông báo lỗi",
  "error": "ERROR_CODE"
}
```

## Module docs

- [Auth](./auth.md)
- [Users](./users.md)
- [Plans](./plans.md)
- [Membership](./membership.md)
- [Payments](./payments.md)
- [Check-in](./check-in.md)
- [Coach](./coach.md)
- [PT Package](./pt-package.md)
- [PT Booking](./pt-booking.md)
- [Branch](./branch.md)
- [Dashboard](./dashboard.md)
- [Equipment](./equipment.md)

## Endpoint ngoài module

| Method | Link | Mô tả | Trả về |
| --- | --- | --- | --- |
| GET | `/` | Health check | Text: `Gym Api is running` |
| GET | `/oauth/success` | Trang test OAuth success tạm thời | HTML hiển thị query params |
| GET | `/oauth/error` | Trang test OAuth error tạm thời | HTML hiển thị query params |

