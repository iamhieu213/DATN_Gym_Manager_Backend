# PT Package API

Base path: `/pt-package`

## Cảnh báo theo code hiện tại

Trong `src/modules/pt-package/pt-package.route.ts`, dòng `router.use(authMiddleware)` đang bị comment. Tuy nhiên controller lại đọc `req.user?.role`. Vì vậy với code hiện tại, các endpoint trong module này sẽ không có `req.user` và nhiều API sẽ trả `403 FORBIDDEN` ngay cả khi client gửi Bearer token. Để các API hoạt động đúng như service thiết kế, cần bật middleware auth ở route.

Tài liệu dưới đây mô tả hành vi theo controller/service khi có `req.user`.

## Enum `TrainingGoal`

- `WEIGHT_LOSS`
- `MUSCLE_GAIN`
- `COMPETITION_PREP`
- `REHABILITATION`
- `GENERAL_FITNESS`

## Kiểu dữ liệu package

```json
{
  "id": 1,
  "name": "Combo 20 buổi",
  "code": "PT_20",
  "numberOfSessions": 20,
  "durationDays": 60,
  "goal": "MUSCLE_GAIN",
  "isActive": true,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

## GET `/pt-package`

Lấy danh sách gói PT mẫu.

Auth theo service: cần role trong token. `ADMIN` có thể xem cả active/inactive; role khác chỉ xem active.

Query:

| Tên | Mô tả |
| --- | --- |
| `goal` | Lọc theo `TrainingGoal` |
| `isActive` | `true` hoặc `false`, chỉ áp dụng cho `ADMIN` |

Trả về `200`: `data` là mảng package.

## GET `/pt-package/:id/coaches`

Lấy danh sách PT dạy một gói cụ thể, kèm giá và có thể lọc lịch rảnh.

Auth theo service: cần role trong token. Nếu package inactive và role không phải `ADMIN`, trả `PACKAGE_NOT_FOUND`.

Query:

| Tên | Mô tả |
| --- | --- |
| `dayOfWeek` | Ngày trong tuần |
| `startTime` | Ví dụ `18:00` |
| `endTime` | Ví dụ `20:00` |
| `slots` | JSON string mảng slot |

Trả về `200`: `data` là danh sách PT và bảng giá tương ứng của gói.

## POST `/pt-package`

Admin tạo gói PT mẫu.

Auth theo service: role `ADMIN`.

Body:

```json
{
  "code": "PT_20",
  "name": "Combo 20 buổi",
  "numberOfSessions": 20,
  "durationDays": 60,
  "goal": "MUSCLE_GAIN",
  "isActive": true
}
```

Trả về `201`: `data` là package mới.

Lỗi thường gặp: `MISSING_REQUIRED_FIELDS`, `PACKAGE_CODE_ALREADY_EXISTS`, `FORBIDDEN`.

## POST `/pt-package/set-price`

Admin thiết lập giá riêng của PT cho một gói.

Auth theo service: role `ADMIN`.

Body:

```json
{
  "coachId": 1,
  "ptPackageId": 1,
  "price": 3000000
}
```

Trả về `200`: `data` là bản ghi `coach_pt_packages`.

## Controller có nhưng route chưa khai báo

Các handler sau tồn tại trong controller/service nhưng chưa được gắn vào route hiện tại:

| Handler | Dự kiến chức năng |
| --- | --- |
| `updatePackage` | Cập nhật gói PT mẫu |
| `activatePackage` | Mở hoạt động package |
| `deactivatePackage` | Khóa hoạt động package |
| `activateCoachPackage` | Cho phép PT dạy package |
| `deactivateCoachPackage` | Khóa quyền dạy package của PT |

