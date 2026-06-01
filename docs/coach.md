# Coach API

Base path: `/coach`

## Kiểu dữ liệu chính

Coach profile lấy từ bảng `coach_profiles`, thường kèm user, lịch rảnh, packages tùy repository include:

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

## GET `/coach`

Lấy danh sách PT public đang available.

Auth: không cần.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |
| `search` | Tìm theo tên user của PT |
| `goal` | Lọc theo mục tiêu gói PT: `WEIGHT_LOSS`, `MUSCLE_GAIN`, `COMPETITION_PREP`, `REHABILITATION`, `GENERAL_FITNESS` |
| `ptPackageId` | Lọc PT có dạy gói này |
| `dayOfWeek` | Ngày trong tuần: `0` Chủ nhật, `1` Thứ 2, ..., `6` Thứ 7 |
| `startTime` | Giờ bắt đầu, ví dụ `18:00` |
| `endTime` | Giờ kết thúc, ví dụ `20:00` |
| `slots` | JSON string mảng khung giờ, ví dụ `[{"dayOfWeek":1,"startTime":"18:00","endTime":"20:00"}]` |

Trả về `200`:

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

## GET `/coach/:id`

Lấy chi tiết PT theo `CoachProfile.id`.

Auth: không cần.

Trả về `200`: `data` là coach profile.

## GET `/coach/profile/me`

PT xem hồ sơ của chính mình.

Auth: cần Bearer token, role `COACH`.

Trả về `200`: `data` là coach profile của user đang đăng nhập.

## PUT `/coach/profile`

PT cập nhật hồ sơ của chính mình.

Auth: cần Bearer token, role `COACH`.

Body:

```json
{
  "speciality": "Muscle Gain",
  "bio": "PT 5 năm kinh nghiệm"
}
```

Trả về `200`: `data` là profile sau cập nhật.

## GET `/coach/availability/me`

PT xem lịch rảnh của chính mình.

Auth: cần Bearer token, role `COACH`.

Trả về `200`: `data` là mảng availability.

## PUT `/coach/availability`

PT cập nhật lịch rảnh.

Auth: cần Bearer token, role `COACH`.

Body:

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

Trả về `200`:

```json
{
  "success": true,
  "message": "Cập nhật lịch làm việc rảnh thành công."
}
```

## GET `/coach/admin/list`

Admin xem danh sách toàn bộ PT.

Auth: cần Bearer token, role `ADMIN`.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |
| `search` | Tìm theo tên user của PT |
| `isAvailable` | `true` hoặc `false` |

Trả về `200`: `data` là mảng coach, `meta` là phân trang.

## PATCH `/coach/admin/:id/status`

Admin bật/tắt trạng thái nhận khách của PT.

Auth: cần Bearer token, role `ADMIN`.

Path `id`: `CoachProfile.id`.

Body:

```json
{
  "isAvailable": true
}
```

Trả về `200`: `data` là profile sau cập nhật.

