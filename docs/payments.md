# Payments API

Base path: `/payments`

Các callback VNPAY không cần auth. Các API còn lại cần Bearer token.

## Cảnh báo theo route hiện tại

Trong `src/modules/payment/payment.route.ts`, route `GET /:paymentId` đang được khai báo trước `GET /list`. Với Express, request `GET /payments/list` sẽ bị match vào `/:paymentId` trước, làm `paymentId = "list"` và trả lỗi mã hóa đơn không hợp lệ.

Để `GET /payments/list` hoạt động đúng, nên đặt `router.get('/list', adminGetPayments)` trước `router.get('/:paymentId', getPaymentDetail)`.

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`

## Kiểu dữ liệu payment

```json
{
  "id": 1,
  "user_id": 1,
  "membership_id": 1,
  "plan_id": 1,
  "coach_assignment_id": null,
  "amount": "500000",
  "method": "VNPAY",
  "status": "PENDING",
  "transaction_ref": null,
  "gateway_response": null,
  "paid_at": null,
  "created_at": "2026-06-01T00:00:00.000Z"
}
```

## GET `/payments/vnpay-ipn`

Webhook/IPN từ VNPAY.

Auth: không cần.

Query: các tham số VNPAY như `vnp_TxnRef`, `vnp_Amount`, `vnp_ResponseCode`, `vnp_TransactionNo`, `vnp_SecureHash`, ...

Trả về `200` theo format VNPAY:

```json
{
  "RspCode": "00",
  "Message": "Confirm success"
}
```

Các mã khác:

| RspCode | Ý nghĩa |
| --- | --- |
| `97` | Sai chữ ký |
| `01` | Không tìm thấy order/payment |
| `04` | Sai số tiền |
| `02` | Order đã được xác nhận trước đó |
| `99` | Lỗi hệ thống |

Nếu `vnp_ResponseCode = "00"`, service xác nhận payment. Nếu không, payment được cập nhật `FAILED`.

## GET `/payments/vnpay-return`

Return URL sau thanh toán VNPAY.

Auth: không cần.

Query: các tham số VNPAY tương tự IPN.

Trả về: HTML thông báo thành công/thất bại. Nếu thanh toán thành công và payment còn `PENDING`, service xác nhận payment.

## POST `/payments/:paymentId/pay`

Tạo link thanh toán VNPAY cho hóa đơn.

Auth: cần Bearer token.

Quyền: user chỉ thanh toán được hóa đơn của chính mình.

Path params:

| Tên | Mô tả |
| --- | --- |
| `paymentId` | ID hóa đơn |

Body: không dùng trong controller hiện tại. Nếu payment đang có method khác `VNPAY`, service tự cập nhật method sang `VNPAY`.

Thành công `200`:

```json
{
  "success": true,
  "message": "Tạo link thanh toán VNPAY thành công.",
  "data": {
    "paymentId": 1,
    "amount": "500000",
    "paymentUrl": "https://..."
  }
}
```

Lỗi thường gặp:

| Status | Lỗi |
| --- | --- |
| `400` | Mã hóa đơn không hợp lệ, `PAYMENT_ALREADY_PROCESSED` |
| `403` | `FORBIDDEN` |
| `404` | `PAYMENT_NOT_FOUND` |

## GET `/payments/my-history`

Lấy lịch sử giao dịch của user đang đăng nhập.

Auth: cần Bearer token.

Trả về `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "amount": "500000",
      "method": "CASH",
      "status": "PAID",
      "membership": {
        "plan": {}
      },
      "coachAssignment": null
    }
  ]
}
```

`data` là danh sách payment của user, sắp xếp `created_at` giảm dần, include:

- `membership.plan`
- `coachAssignment.ptPackage`

## GET `/payments/:paymentId`

Xem chi tiết một hóa đơn.

Auth: cần Bearer token.

Quyền:

- `ADMIN`, `STAFF`: xem được mọi hóa đơn.
- User thường: chỉ xem được hóa đơn của chính mình.

Path params:

| Tên | Mô tả |
| --- | --- |
| `paymentId` | ID hóa đơn |

Trả về `200`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "membership_id": 1,
    "coach_assignment_id": null,
    "amount": "500000",
    "method": "VNPAY",
    "status": "PENDING",
    "user": {
      "id": 1,
      "name": "Nguyen Van A",
      "email": "user@example.com",
      "phone": "0900000000"
    },
    "membership": {
      "plan": {}
    },
    "coachAssignment": null
  }
}
```

Nếu là hóa đơn PT, `coachAssignment` include:

- `ptPackage`
- `coach.user.name`

Lỗi thường gặp: `PAYMENT_NOT_FOUND`, `FORBIDDEN`.

## POST `/payments/:paymentId/confirm`

Admin/staff xác nhận thanh toán tiền mặt.

Auth: cần Bearer token.

Quyền theo service nghiệp vụ: `ADMIN`, `STAFF`.

Path params:

| Tên | Mô tả |
| --- | --- |
| `paymentId` | ID hóa đơn |

Thành công `200`:

```json
{
  "success": true,
  "message": "Duyệt thanh toán tiền mặt thành công."
}
```

Service sẽ điều phối:

- Payment membership: gọi `MembershipsService.confirmPayment`.
- Payment PT assignment: gọi `PtBookingService.confirmPayment`.
- Payment khác: cập nhật payment sang `PAID`.

## GET `/payments/list`

Admin/staff xem danh sách hóa đơn có phân trang, tìm kiếm và lọc trạng thái.

Auth: cần Bearer token.

Quyền: `ADMIN`, `STAFF`.

Lưu ý route order: với code hiện tại endpoint này bị `GET /:paymentId` bắt trước. Cần đổi thứ tự route như ghi ở đầu file.

Query:

| Tên | Mô tả |
| --- | --- |
| `page` | Trang, mặc định `1` |
| `limit` | Số bản ghi/trang, mặc định `10` |
| `status` | Lọc theo `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `search` | Tìm theo user `name`, `email`, `phone` |

Trả về `200`:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "amount": "500000",
      "method": "CASH",
      "status": "PENDING",
      "created_at": "2026-06-01T00:00:00.000Z"
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

