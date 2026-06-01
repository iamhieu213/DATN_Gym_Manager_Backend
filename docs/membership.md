# Membership API

Base path: `/membership`

Tất cả API trong module này cần Bearer token.

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- `MembershipStatus`: `ACTIVE`, `EXPIRED`, `CANCELLED`, `PENDING`, `UPGRADED`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`

## POST `/membership/buy`

Đăng ký mua gói tập mới.

Quyền: user đã đăng nhập.

Body:

```json
{
  "planId": 1,
  "paymentMethod": "CASH"
}
```

Thành công `201`:

```json
{
  "success": true,
  "message": "Đăng ký mua gói tập thành công. Vui lòng thanh toán hóa đơn.",
  "data": {
    "membershipId": 1,
    "paymentId": 10,
    "amount": "500000",
    "method": "CASH",
    "status": "PENDING"
  }
}
```

Lỗi thường gặp: `PLAN_NOT_FOUND`, `ALREADY_HAVE_ACTIVE_PLAN`.

## POST `/membership/upgrade`

Nâng cấp gói tập đang active.

Quyền: user đã đăng nhập.

Body:

```json
{
  "newPlanId": 2,
  "paymentMethod": "VNPAY"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Tạo yêu cầu nâng cấp thành công. Vui lòng thanh toán số tiền chênh lệch.",
  "data": {
    "membershipId": 2,
    "paymentId": 11,
    "amount": "700000",
    "remainingValue": 300000,
    "method": "VNPAY",
    "status": "PENDING"
  }
}
```

Lỗi thường gặp: `NO_ACTIVE_PLAN_TO_UPGRADE`, `CANNOT_DOWNGRADE_OR_EQUAL`, `PLAN_NOT_FOUND`.

## GET `/membership/active`

Lấy gói tập active hiện tại của user.

Quyền: user đã đăng nhập.

Trả về `200`: `data` là membership active hoặc `null`.

Nếu đọc từ Redis cache, `data` có dạng rút gọn:

```json
{
  "membershipId": 1,
  "planId": 1,
  "planName": "Gói 1 tháng",
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-07-01T00:00:00.000Z"
}
```

Nếu đọc từ database, `data` là membership kèm `plan`.

## GET `/membership/my-history`

Lấy lịch sử mua gói của user.

Quyền: user đã đăng nhập.

Trả về `200`: `data` là mảng membership/history của user.

## GET `/membership`

Admin/staff xem danh sách đăng ký gói tập.

Quyền: `ADMIN`, `STAFF`.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |
| `status` | Lọc theo trạng thái membership |
| `search` | Tìm theo user `name`, `email`, `phone` |

Trả về `200`: `data` là mảng membership, `meta` là phân trang.

## POST `/membership/:id/cancel`

Admin hủy gói tập active.

Quyền theo service hiện tại: chỉ `ADMIN`.

Trả về `200`: `data` là membership sau khi chuyển trạng thái hủy.

Lỗi thường gặp: `MEMBERSHIP_NOT_FOUND`, `MEMBERSHIP_NOT_ACTIVE`, `FORBIDDEN`.

