# Plans API

Base path: `/plan`

Tất cả API trong module này cần Bearer token.

## Kiểu dữ liệu plan

```json
{
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
```

## GET `/plan`

Lấy danh sách gói tập.

Quyền: user đã đăng nhập. Nếu không phải `ADMIN`/`STAFF`, controller ép `is_active=true`.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |
| `search` | Tìm theo `name` hoặc `description` |
| `is_active` | `true` hoặc `false`, chỉ có ý nghĩa đầy đủ với `ADMIN`/`STAFF` |

Trả về `200`: `data` là mảng plan, `meta` là phân trang.

## GET `/plan/:id`

Lấy chi tiết gói tập.

Trả về `200`: `data` là một plan.

Lỗi thường gặp: `PLAN_NOT_FOUND`, `BAD_REQUEST`.

## POST `/plan`

Tạo gói tập.

Quyền theo service hiện tại: chỉ `ADMIN`.

Body:

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

Trả về `201`: `data` là plan mới.

Lỗi thường gặp: `MISSING_REQUIRED_FIELDS`, `PLAN_CODE_ALREADY_EXISTS`, `FORBIDDEN`.

## PATCH `/plan/:id`

Cập nhật gói tập.

Quyền theo service hiện tại: chỉ `ADMIN`.

Body:

```json
{
  "name": "Gói 3 tháng",
  "code": "PLAN_3M",
  "description": "Mô tả mới",
  "price": 1200000,
  "duration_days": 90,
  "features": ["Tập không giới hạn", "Tặng khăn"],
  "is_active": true
}
```

Trả về `200`: `data` là plan sau cập nhật.

## PATCH `/plan/:id/activate`

Mở bán gói tập, set `is_active=true`.

Quyền theo controller comment là admin/staff, nhưng service hiện tại chỉ kiểm tra plan tồn tại và chưa gọi kiểm tra role.

Trả về `200`: `data` là plan sau cập nhật.

## PATCH `/plan/:id/deactivate`

Khóa gói tập, set `is_active=false`.

Quyền theo controller comment là admin/staff, nhưng service hiện tại chỉ kiểm tra plan tồn tại và chưa gọi kiểm tra role.

Trả về `200`: `data` là plan sau cập nhật.

