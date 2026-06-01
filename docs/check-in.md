# Check-in API

Base path: `/check-in`

Tất cả API trong module này cần Bearer token.

## POST `/check-in`

Admin/staff check-in hội viên bằng số điện thoại.

Quyền: `ADMIN`, `STAFF`.

Body:

```json
{
  "phone": "0900000000"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Chào mừng Nguyen Van A đến tập! Điểm danh thành công.",
  "data": {
    "checkInId": 1,
    "checkInAt": "2026-06-01T00:00:00.000Z",
    "user": {
      "id": 1,
      "name": "Nguyen Van A",
      "phone": "0900000000",
      "avatarUrl": null
    },
    "membership": {
      "membershipId": 1,
      "planId": 1,
      "planName": "Gói 1 tháng",
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-07-01T00:00:00.000Z"
    }
  }
}
```

Lỗi thường gặp: `USER_NOT_FOUND`, `NO_ACTIVE_MEMBERSHIP`, `MEMBERSHIP_EXPIRED`, `FORBIDDEN`.

## GET `/check-in/my-history`

User xem lịch sử check-in của chính mình.

Quyền: user đã đăng nhập.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |

Trả về `200`: `data` là mảng check-in của user, `meta` là phân trang.

## GET `/check-in/history`

Admin/staff xem lịch sử check-in toàn phòng tập.

Quyền: `ADMIN`, `STAFF`.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |
| `search` | Tìm theo user `name`, `email`, `phone` |

Trả về `200`: `data` là mảng check-in kèm user, `meta` là phân trang.

