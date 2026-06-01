# Payments API

Base path: `/payments`

Các callback VNPAY không cần auth. Các API còn lại cần Bearer token.

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

Các mã khác: `97` sai chữ ký, `01` không thấy order, `04` sai amount, `02` order đã xác nhận, `99` lỗi hệ thống.

## GET `/payments/vnpay-return`

Return URL sau thanh toán VNPAY.

Auth: không cần.

Trả về: HTML thông báo thanh toán thành công/thất bại. Nếu thanh toán thành công và payment còn `PENDING`, service sẽ xác nhận payment.

## POST `/payments/:paymentId/pay`

Tạo link thanh toán VNPAY cho hóa đơn.

Quyền: chủ hóa đơn.

Path params:

| Tên | Mô tả |
| --- | --- |
| `paymentId` | ID hóa đơn |

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

Ghi chú: nếu payment đang là phương thức khác, service tự chuyển `method` sang `VNPAY`.

## GET `/payments/my-history`

Lấy lịch sử giao dịch của user đang đăng nhập.

Quyền: user đã đăng nhập.

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

## POST `/payments/:paymentId/confirm`

Admin/staff xác nhận thanh toán tiền mặt.

Quyền theo service nghiệp vụ: `ADMIN`, `STAFF`.

Trả về `200`:

```json
{
  "success": true,
  "message": "Duyệt thanh toán tiền mặt thành công."
}
```

## GET `/payments/admin/list`

Admin/staff xem danh sách hóa đơn.

Quyền: `ADMIN`, `STAFF`.

Query:

| Tên | Mô tả |
| --- | --- |
| `status` | Lọc theo `PENDING`, `PAID`, `FAILED`, `REFUNDED` |

Trả về `200`: `data` là mảng payment kèm user, membership/plan hoặc coachAssignment/ptPackage.

