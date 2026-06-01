# Equipment API

Base path: `/equipment`

Tất cả API trong module này cần Bearer token.

## Enum `EquipmentStatus`

- `OPERATIONAL`: hoạt động tốt
- `UNDER_MAINTENANCE`: đang bảo trì
- `OUT_OF_SERVICE`: hỏng hoặc ngừng hoạt động

## Kiểu dữ liệu equipment

```json
{
  "id": 1,
  "name": "Máy chạy bộ",
  "code": "EQ-TM-01",
  "status": "OPERATIONAL",
  "location": "Khu Cardio",
  "purchaseDate": "2026-06-01T00:00:00.000Z",
  "lastMaintenanceDate": null,
  "note": null,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

Ghi chú: DTO hiện tại chưa nhận `location` khi tạo/cập nhật, dù model Prisma có field này.

## POST `/equipment`

Tạo hàng loạt thiết bị mới, tự sinh mã theo `baseCode`.

Auth: cần Bearer token.

Quyền: `ADMIN`.

Body:

```json
{
  "name": "Máy chạy bộ",
  "baseCode": "EQ-TM",
  "quantity": 3,
  "purchaseDate": "2026-06-01",
  "note": "Lô nhập tháng 6"
}
```

Logic sinh mã:

- Tìm các equipment có `code` bắt đầu bằng `baseCode`.
- Lấy suffix số lớn nhất sau dấu `-`.
- Tạo tiếp mã dạng `EQ-TM-01`, `EQ-TM-02`, ...
- Thiết bị mới mặc định `status = OPERATIONAL`.

Thành công `201`:

```json
{
  "success": true,
  "message": "Đã thêm mới 3 thiết bị thành công."
}
```

Lỗi thường gặp:

| Status | Lỗi |
| --- | --- |
| `400` | `INVALID_QUANTITY` |
| `403` | `FORBIDDEN` |

## GET `/equipment/summary`

Xem danh sách thiết bị đã gom nhóm theo `name`.

Auth: cần Bearer token.

Quyền: route yêu cầu đăng nhập. Service hiện tại không giới hạn role, comment route cho phép `ADMIN`, `STAFF`, `COACH`, `USER`.

Query:

| Tên | Mô tả |
| --- | --- |
| `search` | Tìm theo tên thiết bị |

Trả về `200`:

```json
{
  "success": true,
  "data": [
    {
      "name": "Máy chạy bộ",
      "totalCount": 5,
      "operationalCount": 4,
      "brokenCount": 1
    }
  ]
}
```

Ghi chú: `brokenCount` hiện được tính là tổng các thiết bị không ở trạng thái `OPERATIONAL`, bao gồm cả `UNDER_MAINTENANCE` và `OUT_OF_SERVICE`.

## GET `/equipment/details`

Xem danh sách chi tiết các máy trong một nhóm `name`.

Auth: cần Bearer token.

Quyền: mọi role đã đăng nhập. Với role `USER` hoặc `COACH`, service chỉ trả các field không nhạy cảm: `id`, `name`, `code`, `status`. Với `ADMIN`/`STAFF`, trả đầy đủ equipment.

Query:

| Tên | Bắt buộc | Mô tả |
| --- | --- | --- |
| `name` | Có | Tên nhóm thiết bị, ví dụ `Máy chạy bộ` |
| `page` | Không | Trang, mặc định `1` |
| `limit` | Không | Số bản ghi/trang, mặc định `10` |
| `status` | Không | Lọc theo `EquipmentStatus` |
| `search` | Không | Tìm theo `code` |

Trả về `200` cho `ADMIN`/`STAFF`:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Máy chạy bộ",
      "code": "EQ-TM-01",
      "status": "OPERATIONAL",
      "purchaseDate": "2026-06-01T00:00:00.000Z",
      "lastMaintenanceDate": null,
      "note": "Lô nhập tháng 6"
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

Trả về `200` cho `USER`/`COACH`:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Máy chạy bộ",
      "code": "EQ-TM-01",
      "status": "OPERATIONAL"
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

Lỗi thường gặp: thiếu `name` trả `BAD_REQUEST`.

## PUT `/equipment/bulk-update`

Cập nhật hàng loạt thiết bị theo danh sách ID.

Auth: cần Bearer token.

Quyền: `ADMIN`, `STAFF`.

Body:

```json
{
  "ids": [1, 2, 3],
  "status": "UNDER_MAINTENANCE",
  "note": "Bảo trì định kỳ",
  "lastMaintenanceDate": "2026-06-01"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Đã cập nhật 3 thiết bị thành công."
}
```

Lỗi thường gặp: `BAD_REQUEST` nếu `ids` rỗng hoặc không truyền.

## POST `/equipment/bulk-delete`

Xóa hàng loạt thiết bị theo danh sách ID.

Auth: cần Bearer token.

Quyền: `ADMIN`, `STAFF`.

Body:

```json
{
  "ids": [1, 2, 3]
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Đã xóa 3 thiết bị thành công."
}
```

Lỗi thường gặp: `BAD_REQUEST` nếu `ids` rỗng hoặc không truyền.

## PUT `/equipment/:id`

Cập nhật một thiết bị cụ thể.

Auth: cần Bearer token.

Quyền: `ADMIN`, `STAFF`.

Path params:

| Tên | Mô tả |
| --- | --- |
| `id` | ID thiết bị |

Body:

```json
{
  "status": "OUT_OF_SERVICE",
  "note": "Hỏng motor",
  "lastMaintenanceDate": "2026-06-01"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Cập nhật thiết bị thành công.",
  "data": {
    "id": 1,
    "name": "Máy chạy bộ",
    "code": "EQ-TM-01",
    "status": "OUT_OF_SERVICE",
    "note": "Hỏng motor"
  }
}
```

Lỗi thường gặp: `BAD_REQUEST`, `EQUIPMENT_NOT_FOUND`, `FORBIDDEN`.

## DELETE `/equipment/:id`

Xóa một thiết bị cụ thể.

Auth: cần Bearer token.

Quyền: `ADMIN`, `STAFF`.

Path params:

| Tên | Mô tả |
| --- | --- |
| `id` | ID thiết bị |

Thành công `200`:

```json
{
  "success": true,
  "message": "Xóa thiết bị thành công."
}
```

Lỗi thường gặp: `BAD_REQUEST`, `EQUIPMENT_NOT_FOUND`, `FORBIDDEN`.

