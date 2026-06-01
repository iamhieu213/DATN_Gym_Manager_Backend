# PT Booking API

Base path: `/pt-booking`

Tất cả API trong module này cần Bearer token.

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- Assignment status trong code dạng string: `PENDING`, `ACTIVE`, `COMPLETED`, `EXPIRED`, `CANCELLED`
- Change request status dạng string: `PENDING`, `REJECTED`, `APPROVED`, `AWAITING_PAYMENT`

## POST `/pt-booking/hire`

Hội viên đăng ký thuê PT.

Quyền: user đã đăng nhập.

Body:

```json
{
  "coachId": 1,
  "ptPackageId": 1,
  "paymentMethod": "CASH"
}
```

Thành công `201`:

```json
{
  "success": true,
  "message": "Đăng ký thuê PT thành công. Vui lòng tiến hành thanh toán.",
  "data": {
    "assignmentId": 1,
    "paymentId": 10,
    "amount": "3000000"
  }
}
```

Lỗi thường gặp: `HAVE_PENDING_ASSIGNMENT_LIMIT`, `ALREADY_HAVE_ACTIVE_COACH`, `COACH_DOES_NOT_OFFER_PACKAGE`, `PACKAGE_NOT_FOUND`.

## GET `/pt-booking/my-coach`

Lấy PT active hiện tại của user.

Quyền: user đã đăng nhập.

Trả về `200`: `data` là assignment active kèm coach/user/ptPackage hoặc `null`.

## GET `/pt-booking/my-bookings`

Lấy danh sách đăng ký PT của user.

Quyền: user đã đăng nhập.

Trả về `200`: `data` là mảng assignment kèm coach, ptPackage và payments.

## POST `/pt-booking/my-booking/:id/cancel`

Hội viên hủy đơn thuê PT chưa thanh toán.

Quyền: chủ assignment.

Path `id`: `CoachAssignment.id`.

Trả về `200`:

```json
{
  "success": true,
  "message": "Hủy đơn đăng ký thuê PT thành công."
}
```

Lỗi thường gặp: `ASSIGNMENT_NOT_FOUND`, `CANNOT_CANCEL_NON_PENDING_ASSIGNMENT`.

## POST `/pt-booking/change-coach/:assignmentId`

Hội viên đổi PT. Nếu assignment còn `PENDING`, đổi trực tiếp và cập nhật hóa đơn. Nếu assignment `ACTIVE`, tạo yêu cầu chờ admin/staff duyệt.

Quyền: chủ assignment.

Body:

```json
{
  "newCoachId": 2,
  "newPtPackageId": 1,
  "paymentMethod": "VNPAY",
  "reason": "Muốn đổi lịch tập phù hợp hơn"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Gửi yêu cầu đổi thành công...",
  "data": {
    "isDirectChange": false,
    "assignmentId": null,
    "requestId": 5,
    "paymentId": null
  }
}
```

Nếu đổi trực tiếp khi chưa thanh toán, `isDirectChange=true`, có `assignmentId` và `paymentId`.

## GET `/pt-booking/my-students`

PT xem danh sách học viên active của mình.

Quyền: role `COACH`.

Trả về `200`: `data` là mảng assignment active kèm user.

## POST `/pt-booking/admin/direct-change`

Admin/staff đổi PT trực tiếp cho một assignment.

Quyền: `ADMIN`, `STAFF`.

Body:

```json
{
  "assignmentId": 1,
  "newCoachId": 2
}
```

Trả về `200`: `data` là assignment sau cập nhật.

## PUT `/pt-booking/admin/change-request/:requestId/process`

Admin/staff duyệt hoặc từ chối yêu cầu đổi PT.

Quyền: `ADMIN`, `STAFF`.

Body:

```json
{
  "approve": true
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Thông báo xử lý",
  "data": {
    "status": "APPROVED",
    "paymentId": null
  }
}
```

Nếu có chênh lệch giá > 0, trả `status = AWAITING_PAYMENT` và `paymentId` là hóa đơn cần thanh toán.

## GET `/pt-booking/admin/change-requests`

Admin/staff xem danh sách yêu cầu đổi PT.

Quyền: `ADMIN`, `STAFF`.

Query:

| Tên | Mô tả |
| --- | --- |
| `status` | Lọc theo trạng thái request |

Trả về `200`: `data` là mảng change request kèm user, oldCoach, newCoach, newPtPackage, payment.

## GET `/pt-booking/admin/bookings`

Admin/staff xem toàn bộ hợp đồng thuê PT.

Quyền: `ADMIN`, `STAFF`.

Query:

| Tên | Mô tả |
| --- | --- |
| `status` | Lọc theo status assignment |

Trả về `200`: `data` là mảng assignment kèm user, coach, ptPackage, payments.

