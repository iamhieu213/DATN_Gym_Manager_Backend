# PT Booking API

Base path: `/pt-booking`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

Danh sách route (10):

| Method | Path | Quyền |
| --- | --- | --- |
| POST | `/pt-booking/hire` | Mọi tài khoản đã đăng nhập (không kiểm tra role) |
| GET | `/pt-booking/my-coach` | Mọi tài khoản đã đăng nhập (không kiểm tra role) |
| GET | `/pt-booking/my-bookings` | Mọi tài khoản đã đăng nhập (không kiểm tra role) |
| POST | `/pt-booking/my-booking/:id/cancel` | Chủ sở hữu hợp đồng |
| POST | `/pt-booking/change-coach/:assignmentId` | Chủ sở hữu hợp đồng |
| GET | `/pt-booking/my-students` | `COACH` |
| POST | `/pt-booking/admin/direct-change` | `ADMIN`, `STAFF` |
| PUT | `/pt-booking/admin/change-request/:requestId/process` | `ADMIN`, `STAFF` |
| GET | `/pt-booking/admin/change-requests` | `ADMIN`, `STAFF` |
| GET | `/pt-booking/admin/bookings` | `ADMIN`, `STAFF` |

---

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- **Trạng thái hợp đồng PT (Assignment Status):** `PENDING` (Chờ thanh toán), `ACTIVE` (Đang hoạt động), `COMPLETED` (Đã hoàn thành), `EXPIRED` (Hết hạn), `CANCELLED` (Đã hủy). Trong code hiện tại chỉ `PENDING`, `ACTIVE`, `CANCELLED` được gán; `COMPLETED`/`EXPIRED` chỉ được khai báo (xem mục "Máy trạng thái").
- **Trạng thái yêu cầu đổi PT (Change Request Status):** `PENDING` (Chờ duyệt), `REJECTED` (Đã từ chối), `APPROVED` (Đã duyệt), `AWAITING_PAYMENT` (Đang chờ thanh toán khoản chênh lệch).

Cột `status` của `CoachAssignment` và `CoachChangeRequest` là chuỗi tự do (`VarChar(50)`), không phải enum ở tầng DB.

---

## Định dạng lỗi chung

- `401` (do `authMiddleware`, body **không** có `success`):
  - `{ "error": "Unauthorized" }`: thiếu header `Authorization` hoặc không có dạng `Bearer <token>`.
  - `{ "error": "Invalid token" }`: token sai hoặc hết hạn.
- Lỗi nghiệp vụ: `{ "success": false, "message": "<thông báo tiếng Việt>" }`. Response **không có** trường `error`/mã lỗi. Các mã như `ASSIGNMENT_NOT_FOUND` trong tài liệu này là định danh nội bộ (giá trị `Error.message` do service ném ra) để tra cứu; client phân biệt lỗi bằng HTTP status và `message`.
- Lỗi không nằm trong bảng dưới đây, hoặc lỗi validate của Prisma (thiếu field, sai kiểu, id không phải số...) đều rơi vào `500` `"Lỗi hệ thống. Vui lòng thử lại sau."`. Module này **không có lớp validate body/param riêng** (xem từng endpoint).

Bảng mã lỗi trong `mapError` của controller:

| Mã nội bộ | HTTP | `message` trả về |
| --- | --- | --- |
| `HAVE_PENDING_ASSIGNMENT_LIMIT` | 400 | Bạn đang có một đăng ký thuê PT chờ thanh toán. Vui lòng thanh toán hoặc hủy đơn cũ trước khi tạo đơn mới. |
| `ALREADY_HAVE_ACTIVE_COACH` | 400 | Bạn đang có huấn luyện viên hỗ trợ hoạt động. |
| `COACH_DOES_NOT_OFFER_PACKAGE` | 400 | Huấn luyện viên không nhận gói combo này hoặc chưa có bảng giá. |
| `PACKAGE_NOT_FOUND` | 404 | Không tìm thấy gói combo PT yêu cầu. |
| `ASSIGNMENT_NOT_FOUND` | 404 | Không tìm thấy hợp đồng PT. |
| `MEMBER_ALREADY_TRAINED_SESSIONS` | 400 | Không thể đổi PT vì hội viên đã thực hiện buổi tập. |
| `NEW_COACH_DOES_NOT_OFFER_PACKAGE` | 400 | Huấn luyện viên mới không nhận gói tập này. |
| `ALREADY_HAVE_PENDING_CHANGE_REQUEST` | 400 | Bạn đang có một yêu cầu đổi huấn luyện viên chờ duyệt. Vui lòng không gửi trùng lặp. |
| `REQUEST_NOT_FOUND_OR_PROCESSED` | 400 | Yêu cầu đổi PT không tồn tại hoặc đã được xử lý. |
| `CANNOT_CANCEL_NON_PENDING_ASSIGNMENT` | 400 | Chỉ được phép hủy đơn hàng chưa thanh toán. |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện hành động này. |
| `DOWNGRADE_NOT_SUPPORTED` | 400 | Hệ thống không hỗ trợ đổi sang gói tập có giá trị thấp hơn gói hiện tại. Vui lòng liên hệ ban quản lý phòng gym để được hỗ trợ thủ công. |
| (mọi mã khác) | 500 | Lỗi hệ thống. Vui lòng thử lại sau. |

Các mã có trong `mapError` nhưng **không route nào của module này ném ra**: `ASSIGNMENT_NOT_ACTIVE`, `REASON_REQUIRED_FOR_ACTIVE_ASSIGNMENT` (không ai ném ra, nên `reason` thực tế không bắt buộc), `PAYMENT_NOT_FOUND` và `PAYMENT_ALREADY_PROCESSED` (chỉ được ném bởi luồng xác nhận thanh toán của module `/payments`, được map ở controller của module đó).

Mã nội bộ **không** có trong `mapError` nên luôn ra `500`: `INVALID_ASSIGNMENT_STATUS` (đổi PT với hợp đồng không phải `PENDING`/`ACTIVE`).

---

## Máy trạng thái & luồng nghiệp vụ

### `CoachAssignment.status` (hợp đồng thuê PT)

```text
POST /hire ──► PENDING ──(hóa đơn được xác nhận PAID)──► ACTIVE
                 │
                 ├─(hội viên gọi POST /my-booking/:id/cancel)──────────────► CANCELLED
                 └─(cron: hóa đơn PENDING online > 15 phút chưa thanh toán)─► CANCELLED
```

| Giá trị | Do đâu chuyển sang |
| --- | --- |
| `PENDING` | Tạo bởi `POST /hire` (cùng 1 `Payment` `PENDING`). |
| `ACTIVE` | Khi hóa đơn thuê PT được xác nhận thanh toán ở module `/payments` (`POST /payments/:paymentId/confirm` do `ADMIN`/`STAFF`, hoặc callback VNPAY). Lúc đó `startDate = ngày hiện tại`, `endDate = ngày hiện tại + PtPackage.durationDays` (mặc định 30 ngày nếu không có gói), `Payment` chuyển `PAID`, xóa cache Redis `pt_assignment:active:<userId>`. |
| `CANCELLED` | Hội viên hủy (`POST /my-booking/:id/cancel`) hoặc cron `cron.service.ts` (chạy mỗi 1 phút) hủy hợp đồng `PENDING` có hóa đơn `PENDING` phương thức `VNPAY`/`MOMO`/`BANK_TRANSFER` tạo quá 15 phút (hóa đơn -> `FAILED`). Hóa đơn `CASH` không bị cron hủy. |
| `COMPLETED`, `EXPIRED` | Có trong comment schema nhưng **không có code nào gán**. Hợp đồng hết hạn (`endDate` đã qua) vẫn giữ `status = ACTIVE` trong DB, chỉ không còn được `GET /my-coach` trả về (điều kiện `endDate >= hiện tại`). |

Hợp đồng `ACTIVE` không đổi trạng thái khi đổi PT/gói: chỉ các trường `coachId`, `ptPackageId`, `totalSessions`, `remainingSessions`, `pricePaid` thay đổi.

### `CoachChangeRequest.status` (yêu cầu đổi PT cho hợp đồng đã thanh toán)

```text
POST /change-coach/:assignmentId (hợp đồng ACTIVE) ──► PENDING
   PENDING ──(admin approve != true)────────────────────────────► REJECTED
   PENDING ──(admin approve = true, priceDifference = 0)────────► APPROVED
   PENDING ──(admin approve = true, priceDifference > 0)────────► AWAITING_PAYMENT
   AWAITING_PAYMENT ──(hóa đơn chênh lệch được xác nhận PAID)───► APPROVED
```

- `REJECTED` và `APPROVED` là trạng thái cuối. Không có route nào để từ chối/hủy yêu cầu đang `AWAITING_PAYMENT`.
- Chỉ yêu cầu `PENDING` mới xử lý được bằng `PUT /admin/change-request/:requestId/process`. Việc chống gửi trùng chỉ kiểm tra yêu cầu `PENDING` của cùng hợp đồng (yêu cầu `AWAITING_PAYMENT` không chặn yêu cầu mới).
- Đổi PT bằng luồng yêu cầu chỉ khi hội viên **chưa tập buổi nào** (`remainingSessions === totalSessions`).

### Cách tính giá

- Giá thuê PT lấy từ bảng `CoachPtPackage` (giá riêng của từng PT cho từng gói): `price` của cặp (`coachId`, `ptPackageId`). Bản ghi phải tồn tại và `CoachPtPackage.isActive = true`, nếu không: `COACH_DOES_NOT_OFFER_PACKAGE` (khi thuê) hoặc `NEW_COACH_DOES_NOT_OFFER_PACKAGE` (khi đổi).
- `PtPackage` (gói mẫu) cung cấp `numberOfSessions` (-> `totalSessions`/`remainingSessions`) và `durationDays` (dùng lúc kích hoạt).
- Code **không** kiểm tra `PtPackage.isActive`, `CoachProfile.isAvailable`, lịch rảnh (`CoachAvailability`) hay xung đột lịch, cũng không kiểm tra hội viên có gói tập (Membership) hay không.
- `pricePaid` của hợp đồng: khi thuê = `CoachPtPackage.price`; khi đổi hợp đồng `PENDING` = giá của PT mới; khi đổi hợp đồng `ACTIVE` sau thanh toán chênh lệch = `pricePaid` cũ + số tiền hóa đơn chênh lệch.
- `priceDifference` của yêu cầu đổi = `CoachPtPackage.price` (PT mới, gói đích) - `CoachAssignment.pricePaid` (hiện tại). Nếu `< 0` bị từ chối ngay lúc gửi yêu cầu (`DOWNGRADE_NOT_SUPPORTED`); `= 0` cho phép đổi ngang giá; `> 0` phải đóng thêm.

### Hiệu ứng khi đổi PT thành công (hợp đồng `ACTIVE`)

Áp dụng cho: duyệt yêu cầu ngang giá, xác nhận thanh toán khoản chênh lệch, và (một phần) `POST /admin/direct-change`. Toàn bộ chạy trong 1 transaction Prisma:

1. Cập nhật `CoachAssignment`: `coachId = newCoachId`, `ptPackageId = newPtPackageId` (mặc định gói hiện tại), `totalSessions = remainingSessions = numberOfSessions` của gói đích (reset lại số buổi), `pricePaid` theo quy tắc trên. `startDate`/`endDate` **không** đổi (không tính lại theo `durationDays` của gói mới).
2. `workoutSession.deleteMany({ userId: hội viên, coachId: PT cũ, status: "PLANNED" })`: **xóa cứng** mọi buổi tập cá nhân đang ở trạng thái `PLANNED` giữa hội viên và PT cũ. Buổi ở trạng thái khác (`PENDING_RESCHEDULE`, `COMPLETED`, `SKIPPED`) được giữ nguyên. Điều kiện lọc theo (`userId`, `coachId`), không theo hợp đồng.
3. `CoachChangeRequest.status = APPROVED`.
4. Nếu yêu cầu có `paymentId`: `Payment` -> `PAID` (`paid_at`, `transaction_ref`, `gateway_response`).

`POST /admin/direct-change` chỉ thực hiện bước 1 (chỉ đổi `coachId`) và bước 2.

### Redis & thông báo (side effects)

- Redis key `pt_assignment:active:<userId>` (thực tế có thêm tiền tố `REDIS_KEY_PREFIX`, mặc định `hipu-hrm:dev:`): cache hợp đồng ACTIVE của hội viên, đọc/ghi bởi `GET /my-coach`, TTL = số giây từ hiện tại tới `endDate`. Bị xóa khi: hóa đơn thuê/chênh lệch được xác nhận thanh toán, `POST /admin/direct-change`, duyệt ngang giá ở `PUT /admin/change-request/:requestId/process`. Nếu `REDIS_ENABLED=false`, các thao tác cache là no-op.
- Thông báo được tạo qua `eventEmitter` (`src/services/event.service.ts`), lưu bảng `notifications` và đẩy socket `new_notification` tới người nhận. "Toàn bộ ADMIN/STAFF" = mọi user `status = ACTIVE` có role `ADMIN` hoặc `STAFF`.

| Event | Phát khi | Người nhận / nội dung |
| --- | --- | --- |
| `pt.hired` | `POST /hire` thành công | Hội viên (`PAYMENT_PENDING`, `referenceId = paymentId`) và toàn bộ ADMIN/STAFF ("Đơn thuê PT chờ thu tiền mặt", gửi cho mọi phương thức thanh toán, không chỉ `CASH`). |
| `pt.pending_cancel` | `POST /my-booking/:id/cancel` (phát **trước** khi ghi DB) | Toàn bộ ADMIN/STAFF (`SESSION_CANCELLED`, không có `referenceId`). |
| `pt.change_requested` | `POST /change-coach/:assignmentId` nhánh hợp đồng `ACTIVE` | Toàn bộ ADMIN/STAFF (`COACH_CHANGE_REQUESTED`, `referenceId = requestId`). Nội dung chèn `reason` đúng như body (nếu không gửi `reason` sẽ hiện chuỗi `undefined`). |
| `pt.change_processed` (`approve: true`) | Duyệt ngang giá | Hội viên (`COACH_CHANGE_DECISION`, `referenceId = requestId`), PT mới ("Nhận học viên mới") và PT cũ ("Học viên chuyển PT"). |
| `pt.change_processed` (`approve: false`) | Từ chối yêu cầu | Hội viên (`COACH_CHANGE_DECISION`, "Yêu cầu đổi PT bị từ chối"). |

Không phát event/thông báo cho: đổi trực tiếp hợp đồng `PENDING`, `POST /admin/direct-change`, duyệt sang trạng thái `AWAITING_PAYMENT`, và bước kích hoạt đổi PT khi hóa đơn chênh lệch được thanh toán.

---

## Kiểu dữ liệu chính

`CoachAssignment` (hợp đồng thuê PT). `pricePaid` là `Decimal` nên JSON là chuỗi; `startDate`/`endDate` là kiểu ngày (`@db.Date`):

```json
{
  "id": 1,
  "coachId": 1,
  "userId": 5,
  "ptPackageId": 1,
  "totalSessions": 20,
  "remainingSessions": 20,
  "pricePaid": "3000000",
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-07-31T00:00:00.000Z",
  "status": "ACTIVE",
  "createdAt": "2026-06-01T02:00:00.000Z",
  "updatedAt": "2026-06-01T02:05:00.000Z"
}
```

`CoachChangeRequest` (yêu cầu đổi PT):

```json
{
  "id": 5,
  "userId": 5,
  "assignmentId": 1,
  "oldCoachId": 1,
  "newCoachId": 2,
  "newPtPackageId": 1,
  "priceDifference": "500000",
  "paymentId": null,
  "reason": "Tôi muốn thay đổi lịch tập phù hợp hơn.",
  "status": "PENDING",
  "paymentMethod": "VNPAY",
  "createdAt": "2026-06-10T02:00:00.000Z",
  "updatedAt": "2026-06-10T02:00:00.000Z"
}
```

---

## POST `/pt-booking/hire`

Hội viên đăng ký thuê PT (Huấn luyện viên cá nhân). Tạo hợp đồng `CoachAssignment` ở trạng thái `PENDING` và hóa đơn `Payment` ở trạng thái `PENDING`; hội viên thanh toán hóa đơn ở module `/payments`.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập. Không kiểm tra role.
- **Request Body** (không có validate riêng; thiếu field, sai kiểu hoặc `paymentMethod` không thuộc `PaymentMethod` sẽ bị Prisma từ chối và trả `500`):
  - `coachId` (number, bắt buộc): `CoachProfile.id` của PT.
  - `ptPackageId` (number, bắt buộc): `PtPackage.id` của gói combo.
  - `paymentMethod` (string, bắt buộc): `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`.
  ```json
  {
    "coachId": 1,
    "ptPackageId": 1,
    "paymentMethod": "CASH"
  }
  ```
- **Thứ tự kiểm tra:**
  1. Hội viên đã có hợp đồng ở trạng thái `PENDING` (bất kỳ, chỉ cần 1 hợp đồng) -> `HAVE_PENDING_ASSIGNMENT_LIMIT`.
  2. Hội viên có hợp đồng `ACTIVE` còn hiệu lực (`endDate >= hiện tại`) -> `ALREADY_HAVE_ACTIVE_COACH` (chỉ được thuê 1 PT tại một thời điểm).
  3. Không tồn tại `CoachPtPackage(coachId, ptPackageId)` hoặc `isActive = false` -> `COACH_DOES_NOT_OFFER_PACKAGE`.
  4. Không tìm thấy `PtPackage` -> `PACKAGE_NOT_FOUND` (thực tế gần như không xảy ra vì `CoachPtPackage` có khóa ngoại tới gói).
- **Xử lý (1 transaction):**
  - Tạo `CoachAssignment`: `status = PENDING`, `totalSessions = remainingSessions = PtPackage.numberOfSessions`, `pricePaid = CoachPtPackage.price`, `startDate = endDate = ngày hiện tại` (chỉ là giá trị tạm, được tính lại khi kích hoạt).
  - Tạo `Payment`: `user_id`, `coach_assignment_id`, `amount = CoachPtPackage.price`, `method = paymentMethod`, `status = PENDING`.
  - Sau transaction, phát event `pt.hired` (thông báo cho hội viên và toàn bộ ADMIN/STAFF).
  - Nếu chọn phương thức online (`VNPAY`/`MOMO`/`BANK_TRANSFER`) mà không thanh toán trong 15 phút, cron sẽ chuyển hóa đơn -> `FAILED` và hợp đồng -> `CANCELLED`.
- **Thành công `201`:** `amount` là `Decimal` nên JSON là chuỗi.
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
- **Lỗi thường gặp:**
  - `HAVE_PENDING_ASSIGNMENT_LIMIT` (400): Đang có 1 hợp đồng PT chờ thanh toán (không phải "quá 3 đơn": chỉ cần 1 đơn `PENDING` là bị chặn).
  - `ALREADY_HAVE_ACTIVE_COACH` (400): Đang có hợp đồng PT `ACTIVE` còn hiệu lực.
  - `COACH_DOES_NOT_OFFER_PACKAGE` (400): PT không nhận gói này, chưa có giá, hoặc quyền dạy gói đã bị khóa.
  - `PACKAGE_NOT_FOUND` (404): Không tìm thấy gói PT.
  - `401`: Chưa đăng nhập hoặc token không hợp lệ.
  - `500`: Thiếu/sai kiểu `coachId`, `ptPackageId`, `paymentMethod` (Prisma validation), hoặc lỗi hệ thống.

---

## GET `/pt-booking/my-coach`

Lấy hợp đồng PT đang hoạt động của tài khoản hiện tại.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập. Không kiểm tra role.
- **Điều kiện "đang hoạt động":** hợp đồng `status = ACTIVE` và `endDate >= thời điểm hiện tại`. Trả về hợp đồng đầu tiên tìm được (không sắp xếp).
- **Redis:** Đọc cache `pt_assignment:active:<userId>` trước; nếu có thì trả luôn bản cache (dữ liệu là JSON nên ngày ở dạng chuỗi). Nếu không có cache, đọc DB rồi ghi cache với TTL = số giây từ hiện tại tới `endDate` (không ghi nếu TTL <= 0; không ghi khi kết quả là `null`).
- **Thành công `200`:** `data` là `CoachAssignment` kèm `coach` (`CoachProfile` + `user` với `name`, `email`, `phone`, `avatarUrl`) và `ptPackage` (gói PT mẫu), hoặc `null` nếu không có hợp đồng active.
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "coachId": 1,
      "userId": 5,
      "ptPackageId": 1,
      "totalSessions": 20,
      "remainingSessions": 18,
      "pricePaid": "3000000",
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-07-31T00:00:00.000Z",
      "status": "ACTIVE",
      "createdAt": "2026-06-01T02:00:00.000Z",
      "updatedAt": "2026-06-05T02:00:00.000Z",
      "coach": {
        "id": 1,
        "userId": 2,
        "speciality": "Muscle Gain",
        "bio": "PT 5 năm kinh nghiệm",
        "isAvailable": true,
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-01T00:00:00.000Z",
        "user": {
          "name": "HLV Nguyễn Văn Hùng",
          "email": "hung@example.com",
          "phone": "0900000000",
          "avatarUrl": null
        }
      },
      "ptPackage": {
        "id": 1,
        "name": "Combo 20 buổi",
        "code": "PT_20",
        "numberOfSessions": 20,
        "durationDays": 60,
        "goal": "MUSCLE_GAIN",
        "isActive": true,
        "createdAt": "2026-05-01T00:00:00.000Z",
        "updatedAt": "2026-05-01T00:00:00.000Z"
      }
    }
  }
  ```
- **Lỗi thường gặp:**
  - `401`: Chưa đăng nhập hoặc token không hợp lệ.
  - `500`: Mọi lỗi (kể cả Redis/DB lỗi) đều trả `{ "success": false, "message": "<Error.message gốc>" }`, không đi qua `mapError`.

---

## GET `/pt-booking/my-bookings`

Hội viên xem lịch sử đăng ký thuê PT của bản thân (mọi trạng thái).

- **Quyền hạn:** Mọi tài khoản đã đăng nhập. Chỉ trả hợp đồng có `userId` = người gọi.
- **Thành công `200`:** `data` là mảng `CoachAssignment` sắp xếp `createdAt` giảm dần, không phân trang. Mỗi phần tử kèm:
  - `coach`: `CoachProfile` + `user` (`name`, `avatarUrl`, `phone`).
  - `ptPackage`: gói PT mẫu.
  - `payments`: mảng toàn bộ hóa đơn (`Payment`) của hợp đồng, mới nhất trước (`created_at` giảm dần), gồm cả hóa đơn thuê ban đầu và hóa đơn chênh lệch đổi PT.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "coachId": 1,
        "userId": 5,
        "ptPackageId": 1,
        "totalSessions": 20,
        "remainingSessions": 20,
        "pricePaid": "3000000",
        "startDate": "2026-06-01T00:00:00.000Z",
        "endDate": "2026-06-01T00:00:00.000Z",
        "status": "PENDING",
        "createdAt": "2026-06-01T02:00:00.000Z",
        "updatedAt": "2026-06-01T02:00:00.000Z",
        "coach": {
          "id": 1,
          "userId": 2,
          "speciality": "Muscle Gain",
          "bio": "PT 5 năm kinh nghiệm",
          "isAvailable": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z",
          "user": {
            "name": "HLV Nguyễn Văn Hùng",
            "avatarUrl": null,
            "phone": "0900000000"
          }
        },
        "ptPackage": {
          "id": 1,
          "name": "Combo 20 buổi",
          "code": "PT_20",
          "numberOfSessions": 20,
          "durationDays": 60,
          "goal": "MUSCLE_GAIN",
          "isActive": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z"
        },
        "payments": [
          {
            "id": 10,
            "user_id": 5,
            "membership_id": null,
            "plan_id": null,
            "coach_assignment_id": 1,
            "amount": "3000000",
            "method": "CASH",
            "status": "PENDING",
            "transaction_ref": null,
            "gateway_response": null,
            "paid_at": null,
            "created_at": "2026-06-01T02:00:00.000Z"
          }
        ]
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `401`; `500` khi lỗi hệ thống.

---

## POST `/pt-booking/my-booking/:id/cancel`

Hội viên hủy đơn đăng ký thuê PT chưa thanh toán (chỉ hợp đồng `PENDING`).

- **Quyền hạn:** Hội viên sở hữu hợp đồng đó (không kiểm tra role). Hợp đồng của người khác được coi như không tồn tại.
- **Path Param `id`:** ID hợp đồng (`CoachAssignment.id`, số). Không có kiểm tra định dạng: `id` không phải số sẽ gây lỗi Prisma và trả `500` (khác với `change-coach` có trả `400`).
- **Request Body:** Không có.
- **Xử lý:**
  1. Không có hợp đồng hoặc `userId` khác người gọi -> `ASSIGNMENT_NOT_FOUND`.
  2. `status !== PENDING` (đã `ACTIVE`, `CANCELLED`, ...) -> `CANNOT_CANCEL_NON_PENDING_ASSIGNMENT`.
  3. Phát event `pt.pending_cancel` (thông báo toàn bộ ADMIN/STAFF). Event được phát **trước** khi ghi DB.
  4. Transaction: hợp đồng `PENDING` -> `CANCELLED`; mọi `Payment` `PENDING` của hợp đồng -> `FAILED`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Hủy đơn đăng ký thuê PT thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `ASSIGNMENT_NOT_FOUND` (404): Không tìm thấy hợp đồng hoặc hợp đồng không thuộc về người gọi.
  - `CANNOT_CANCEL_NON_PENDING_ASSIGNMENT` (400): Hợp đồng không ở trạng thái `PENDING`.
  - `401`; `500` (kể cả `id` không phải số).

---

## POST `/pt-booking/change-coach/:assignmentId`

Hội viên đổi PT (và tùy chọn đổi gói). Cách xử lý phụ thuộc trạng thái hợp đồng: đổi trực tiếp nếu chưa thanh toán, gửi yêu cầu chờ duyệt nếu đã thanh toán.

- **Quyền hạn:** Hội viên sở hữu hợp đồng đó (không kiểm tra role). Hợp đồng của người khác được coi như không tồn tại.
- **Path Param `assignmentId`:** ID hợp đồng (số). Không phải số -> `400` `{ "success": false, "message": "Mã hợp đồng PT không hợp lệ." }`.
- **Request Body** (không có validate riêng; thiếu `newCoachId` hoặc sai kiểu/`paymentMethod` không hợp lệ -> `500`):
  - `newCoachId` (number, bắt buộc): `CoachProfile.id` của PT mới.
  - `newPtPackageId` (number, optional): gói đích. Mặc định là gói hiện tại của hợp đồng.
  - `paymentMethod` (string, bắt buộc theo DTO): `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`. Chỉ được lưu vào yêu cầu đổi ở nhánh `ACTIVE` (để tạo hóa đơn chênh lệch sau này); nhánh `PENDING` bỏ qua. Nếu bỏ trống ở nhánh `ACTIVE` thì DB dùng mặc định `CASH`.
  - `reason` (string, optional): lý do. Không bắt buộc ở cả hai nhánh; nhánh `ACTIVE` không gửi thì lưu `"Yêu cầu đổi PT/Gói tập"`.
  ```json
  {
    "newCoachId": 2,
    "newPtPackageId": 1,
    "paymentMethod": "VNPAY",
    "reason": "Tôi muốn thay đổi lịch tập phù hợp hơn."
  }
  ```
- **Kiểm tra chung (trước khi rẽ nhánh):**
  1. Hợp đồng không tồn tại hoặc không thuộc người gọi -> `ASSIGNMENT_NOT_FOUND`.
  2. Không có `CoachPtPackage(newCoachId, gói đích)` hoặc `isActive = false` -> `NEW_COACH_DOES_NOT_OFFER_PACKAGE`.
  3. Không có `PtPackage` gói đích -> `PACKAGE_NOT_FOUND` (thực tế gần như không xảy ra).
  Không có kiểm tra `newCoachId` khác PT hiện tại, và không kiểm tra `CoachProfile.isAvailable`.
- **Nhánh 1: hợp đồng `PENDING` (chưa thanh toán) -> đổi trực tiếp:**
  - Transaction: cập nhật hợp đồng `coachId = newCoachId`, `pricePaid = giá của PT mới`; cập nhật `amount` của **mọi** `Payment` `PENDING` của hợp đồng thành giá mới (`method` của hóa đơn giữ nguyên).
  - Không phát event, không dùng Redis, không tạo yêu cầu đổi.
  - Chỉ `coachId` và `pricePaid` được cập nhật. `ptPackageId`, `totalSessions`, `remainingSessions` của hợp đồng **không** đổi dù có gửi `newPtPackageId` khác gói hiện tại (giá vẫn tính theo gói đích).
  - Response: `isDirectChange: true`, `assignmentId` có giá trị, `requestId: null`, `paymentId` = hóa đơn `PENDING` (đầu tiên) của hợp đồng.
- **Nhánh 2: hợp đồng `ACTIVE` -> tạo yêu cầu đổi chờ duyệt (chưa tạo hóa đơn):**
  1. `remainingSessions !== totalSessions` (đã tập ít nhất 1 buổi) -> `MEMBER_ALREADY_TRAINED_SESSIONS`.
  2. Hợp đồng đã có yêu cầu đổi `PENDING` -> `ALREADY_HAVE_PENDING_CHANGE_REQUEST`.
  3. `priceDifference = giá PT mới (gói đích) - pricePaid hiện tại`; nếu `< 0` -> `DOWNGRADE_NOT_SUPPORTED`. Bằng `0` vẫn được tạo yêu cầu.
  4. Tạo `CoachChangeRequest` (`status = PENDING`, `oldCoachId` = PT hiện tại, `newCoachId`, `newPtPackageId` = gói đích, `priceDifference`, `paymentMethod`, `reason`). Không tạo `Payment`.
  5. Phát event `pt.change_requested` (thông báo toàn bộ ADMIN/STAFF).
  - Response: `isDirectChange: false`, `assignmentId: null`, `requestId`, `paymentId: null`.
- **Hợp đồng ở trạng thái khác (`COMPLETED`, `EXPIRED`, `CANCELLED`)** -> code ném `INVALID_ASSIGNMENT_STATUS` nhưng không được map nên trả `500` "Lỗi hệ thống...".
- **Thành công `200` (đổi trực tiếp hợp đồng `PENDING`):**
  ```json
  {
    "success": true,
    "message": "Đã đổi PT trực tiếp thành công. Vui lòng thanh toán hóa đơn mới.",
    "data": {
      "isDirectChange": true,
      "assignmentId": 1,
      "requestId": null,
      "paymentId": 10
    }
  }
  ```
- **Thành công `200` (gửi yêu cầu cho hợp đồng `ACTIVE`):**
  ```json
  {
    "success": true,
    "message": "Gửi yêu cầu đổi thành công. Vui lòng chờ phê duyệt từ Admin/Staff.",
    "data": {
      "isDirectChange": false,
      "assignmentId": null,
      "requestId": 5,
      "paymentId": null
    }
  }
  ```
- **Lỗi thường gặp:**
  - `400` (không có mã): `assignmentId` không phải số, message "Mã hợp đồng PT không hợp lệ.".
  - `ASSIGNMENT_NOT_FOUND` (404): Không tìm thấy hợp đồng hoặc không thuộc người gọi.
  - `NEW_COACH_DOES_NOT_OFFER_PACKAGE` (400): PT mới không nhận gói đích hoặc quyền dạy gói bị khóa.
  - `PACKAGE_NOT_FOUND` (404): Không tìm thấy gói đích.
  - `MEMBER_ALREADY_TRAINED_SESSIONS` (400): Hợp đồng `ACTIVE` đã tập ít nhất 1 buổi.
  - `ALREADY_HAVE_PENDING_CHANGE_REQUEST` (400): Đã có yêu cầu đổi `PENDING` cho hợp đồng này.
  - `DOWNGRADE_NOT_SUPPORTED` (400): Giá PT mới thấp hơn `pricePaid` hiện tại.
  - `401`; `500` (hợp đồng không phải `PENDING`/`ACTIVE`, thiếu `newCoachId`, sai kiểu dữ liệu...).

---

## GET `/pt-booking/my-students`

Huấn luyện viên xem danh sách hội viên đang được mình dạy.

- **Quyền hạn:** Chỉ `COACH` (role khác -> `FORBIDDEN` 403).
- **Điều kiện:** các hợp đồng có `coach.userId` = người gọi và `status = ACTIVE`. Không kiểm tra `endDate` (hợp đồng đã quá hạn nhưng vẫn `ACTIVE` trong DB vẫn xuất hiện). Nếu tài khoản chưa có hồ sơ coach thì trả mảng rỗng (không báo lỗi).
- **Thành công `200`:** `data` là mảng `CoachAssignment` (không kèm `ptPackage`, không sắp xếp, không phân trang), mỗi phần tử kèm `user` (`name`, `phone`, `email`) là hội viên.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "coachId": 1,
        "userId": 5,
        "ptPackageId": 1,
        "totalSessions": 20,
        "remainingSessions": 18,
        "pricePaid": "3000000",
        "startDate": "2026-06-01T00:00:00.000Z",
        "endDate": "2026-07-31T00:00:00.000Z",
        "status": "ACTIVE",
        "createdAt": "2026-06-01T02:00:00.000Z",
        "updatedAt": "2026-06-05T02:00:00.000Z",
        "user": {
          "name": "Nguyen Van A",
          "phone": "0912345678",
          "email": "a@example.com"
        }
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `FORBIDDEN` (403): không phải `COACH`; `401`; `500`.

---

## POST `/pt-booking/admin/direct-change`

Ban quản trị đổi trực tiếp PT cho hội viên mà không cần hội viên gửi yêu cầu và không cần duyệt.

- **Quyền hạn:** `ADMIN`, `STAFF` (role khác -> `FORBIDDEN` 403).
- **Request Body** (không có validate riêng; thiếu/sai kiểu -> `500`):
  - `assignmentId` (number, bắt buộc): `CoachAssignment.id`.
  - `newCoachId` (number, bắt buộc): `CoachProfile.id` của PT mới.
  ```json
  {
    "assignmentId": 1,
    "newCoachId": 2
  }
  ```
- **Xử lý:**
  1. Không có hợp đồng -> `ASSIGNMENT_NOT_FOUND`.
  2. Không có `CoachPtPackage(newCoachId, ptPackageId hiện tại của hợp đồng)` hoặc `isActive = false` -> `NEW_COACH_DOES_NOT_OFFER_PACKAGE`.
  3. Transaction: cập nhật `coachId = newCoachId` và xóa cứng mọi `WorkoutSession` có `userId` = hội viên, `coachId` = PT cũ, `status = PLANNED` (`workoutSession.deleteMany`).
  4. Xóa cache Redis `pt_assignment:active:<userId của hội viên>`.
- **Lưu ý hành vi:** Không kiểm tra `status` của hợp đồng (áp dụng được cho cả `PENDING`, `ACTIVE`, `CANCELLED`...), không kiểm tra số buổi đã tập, không kiểm tra `newCoachId` khác PT cũ, không thay đổi `pricePaid`/`totalSessions`/`remainingSessions`/hóa đơn dù giá PT mới khác, không phát event/thông báo.
- **Thành công `200`:** `data` là `CoachAssignment` sau khi cập nhật (bản ghi thuần, không kèm quan hệ).
  ```json
  {
    "success": true,
    "message": "Thay đổi huấn luyện viên trực tiếp thành công.",
    "data": {
      "id": 1,
      "coachId": 2,
      "userId": 5,
      "ptPackageId": 1,
      "totalSessions": 20,
      "remainingSessions": 18,
      "pricePaid": "3000000",
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-07-31T00:00:00.000Z",
      "status": "ACTIVE",
      "createdAt": "2026-06-01T02:00:00.000Z",
      "updatedAt": "2026-06-20T02:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `ASSIGNMENT_NOT_FOUND` (404): Không tìm thấy hợp đồng.
  - `NEW_COACH_DOES_NOT_OFFER_PACKAGE` (400): PT mới không nhận gói của hợp đồng hoặc quyền dạy gói bị khóa.
  - `401`; `500` (thiếu `assignmentId`/`newCoachId`, sai kiểu...).

---

## PUT `/pt-booking/admin/change-request/:requestId/process`

Ban quản trị duyệt hoặc từ chối yêu cầu đổi PT của hội viên (yêu cầu ở trạng thái `PENDING`).

- **Quyền hạn:** `ADMIN`, `STAFF` (role khác -> `FORBIDDEN` 403).
- **Path Param `requestId`:** ID yêu cầu (`CoachChangeRequest.id`, số). Không phải số -> lỗi Prisma -> `500`.
- **Request Body:**
  - `approve` (boolean): chỉ đúng giá trị boolean `true` mới là duyệt. Mọi giá trị khác (`false`, thiếu, chuỗi `"true"`, `1`...) đều bị coi là **từ chối**.
  ```json
  {
    "approve": true
  }
  ```
- **Xử lý:**
  1. Yêu cầu không tồn tại hoặc `status !== PENDING` -> `REQUEST_NOT_FOUND_OR_PROCESSED` (400, không phải 404).
  2. **Từ chối** (`approve` khác `true`): `status -> REJECTED`, phát event `pt.change_processed` (`approve: false`, thông báo cho hội viên). Hợp đồng không thay đổi.
  3. **Duyệt và `priceDifference = 0`** (đổi ngang giá): thực hiện ngay các bước ở mục "Hiệu ứng khi đổi PT thành công" (đổi PT/gói, reset số buổi theo gói đích, xóa buổi `PLANNED` của PT cũ, `status -> APPROVED`), giữ nguyên `pricePaid`, xóa cache Redis `pt_assignment:active:<userId>`, phát event `pt.change_processed` (`approve: true`, thông báo hội viên + PT mới + PT cũ).
  4. **Duyệt và `priceDifference > 0`**: tạo `Payment` `PENDING` (`amount = priceDifference`, `method = paymentMethod` đã lưu trong yêu cầu, gắn `coach_assignment_id`), lưu `paymentId` vào yêu cầu, `status -> AWAITING_PAYMENT`. **Chưa** đổi PT và **không** phát event/thông báo. Khi hóa đơn này được xác nhận thanh toán ở module `/payments`, hệ thống mới thực hiện đổi PT/gói (tổng `pricePaid` mới = `pricePaid` cũ + số tiền hóa đơn, `status -> APPROVED`, hóa đơn `PAID`, xóa cache Redis) và cũng không phát event thông báo.
  - Việc rẽ nhánh dựa vào `priceDifference` đã tính lúc hội viên gửi yêu cầu (không tính lại tại thời điểm duyệt). Trường hợp `< 0` không xảy ra vì đã bị chặn lúc gửi yêu cầu.
- **Thành công `200` (duyệt ngang giá):**
  ```json
  {
    "success": true,
    "message": "Phê duyệt thành công. PT đã được đổi trực tiếp do không chênh lệch giá.",
    "data": {
      "status": "APPROVED",
      "paymentId": null
    }
  }
  ```
- **Thành công `200` (duyệt, cần đóng thêm tiền):** `message` chứa số tiền chênh lệch (`priceDifference` của yêu cầu, ghép nguyên văn dạng số, đơn vị VND).
  ```json
  {
    "success": true,
    "message": "Yêu cầu đổi PT đã được duyệt. Tạo hóa đơn đóng tiền chênh lệch thành công: 500000 VND.",
    "data": {
      "status": "AWAITING_PAYMENT",
      "paymentId": 11
    }
  }
  ```
- **Thành công `200` (từ chối):**
  ```json
  {
    "success": true,
    "message": "Đã từ chối yêu cầu đổi PT.",
    "data": {
      "status": "REJECTED",
      "paymentId": null
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `REQUEST_NOT_FOUND_OR_PROCESSED` (400): Yêu cầu không tồn tại hoặc đã được xử lý (không còn `PENDING`).
  - `401`; `500` (`requestId` không phải số, lỗi hệ thống).

---

## GET `/pt-booking/admin/change-requests`

Ban quản trị xem danh sách yêu cầu đổi PT.

- **Quyền hạn:** `ADMIN`, `STAFF` (role khác -> `FORBIDDEN` 403).
  - STAFF và ADMIN đều xem toàn bộ yêu cầu đổi PT trong hệ thống.
- **Query Parameters:**
  - `status` (optional): Lọc theo trạng thái yêu cầu (`PENDING`, `APPROVED`, `REJECTED`, `AWAITING_PAYMENT`). Không có validate: giá trị khác được dùng nguyên văn làm điều kiện lọc và cho kết quả rỗng. Không truyền thì trả mọi trạng thái (không mặc định chỉ `PENDING`).
  - Không có phân trang.
- **Thành công `200`:** `data` là mảng `CoachChangeRequest` sắp xếp `createdAt` giảm dần, mỗi phần tử kèm:
  - `user`: hội viên (`id`, `name`, `email`, `phone`).
  - `oldCoach`, `newCoach`: `CoachProfile` + `user` (chỉ `name`).
  - `newPtPackage`: gói PT đích (hoặc `null`).
  - `payment`: hóa đơn chênh lệch (hoặc `null` nếu chưa có).
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 5,
        "userId": 5,
        "assignmentId": 1,
        "oldCoachId": 1,
        "newCoachId": 2,
        "newPtPackageId": 1,
        "priceDifference": "500000",
        "paymentId": 11,
        "reason": "Tôi muốn thay đổi lịch tập phù hợp hơn.",
        "status": "AWAITING_PAYMENT",
        "paymentMethod": "VNPAY",
        "createdAt": "2026-06-10T02:00:00.000Z",
        "updatedAt": "2026-06-10T03:00:00.000Z",
        "user": {
          "id": 5,
          "name": "Nguyen Van A",
          "email": "a@example.com",
          "phone": "0912345678"
        },
        "oldCoach": {
          "id": 1,
          "userId": 2,
          "speciality": "Muscle Gain",
          "bio": null,
          "isAvailable": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z",
          "user": { "name": "HLV Nguyễn Văn Hùng" }
        },
        "newCoach": {
          "id": 2,
          "userId": 3,
          "speciality": "Weight Loss",
          "bio": null,
          "isAvailable": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z",
          "user": { "name": "HLV Trần Thị Mai" }
        },
        "newPtPackage": {
          "id": 1,
          "name": "Combo 20 buổi",
          "code": "PT_20",
          "numberOfSessions": 20,
          "durationDays": 60,
          "goal": "MUSCLE_GAIN",
          "isActive": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z"
        },
        "payment": {
          "id": 11,
          "user_id": 5,
          "membership_id": null,
          "plan_id": null,
          "coach_assignment_id": 1,
          "amount": "500000",
          "method": "VNPAY",
          "status": "PENDING",
          "transaction_ref": null,
          "gateway_response": null,
          "paid_at": null,
          "created_at": "2026-06-10T03:00:00.000Z"
        }
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `FORBIDDEN` (403): không phải `ADMIN`/`STAFF`; `401`; `500`.

---

## GET `/pt-booking/admin/bookings`

Ban quản trị xem danh sách toàn bộ hợp đồng thuê PT.

- **Quyền hạn:** `ADMIN`, `STAFF` (role khác -> `FORBIDDEN` 403).
  - STAFF và ADMIN đều xem toàn bộ danh sách hợp đồng thuê PT.
- **Query Parameters:**
  - `status` (optional): Lọc theo trạng thái hợp đồng (`PENDING`, `ACTIVE`, `COMPLETED`, `EXPIRED`, `CANCELLED`). Không có validate: giá trị khác cho kết quả rỗng. Không truyền thì trả mọi trạng thái.
  - Không có phân trang.
- **Thành công `200`:** `data` là mảng `CoachAssignment` sắp xếp `createdAt` giảm dần, mỗi phần tử kèm:
  - `user`: hội viên (`id`, `name`, `email`, `phone`).
  - `coach`: `CoachProfile` + `user` (`name`, `phone`).
  - `ptPackage`: gói PT mẫu.
  - `payments`: mảng hóa đơn của hợp đồng, mới nhất trước (`created_at` giảm dần).
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "coachId": 1,
        "userId": 5,
        "ptPackageId": 1,
        "totalSessions": 20,
        "remainingSessions": 20,
        "pricePaid": "3000000",
        "startDate": "2026-06-01T00:00:00.000Z",
        "endDate": "2026-07-31T00:00:00.000Z",
        "status": "ACTIVE",
        "createdAt": "2026-06-01T02:00:00.000Z",
        "updatedAt": "2026-06-01T02:05:00.000Z",
        "user": {
          "id": 5,
          "name": "Nguyen Van A",
          "email": "a@example.com",
          "phone": "0912345678"
        },
        "coach": {
          "id": 1,
          "userId": 2,
          "speciality": "Muscle Gain",
          "bio": "PT 5 năm kinh nghiệm",
          "isAvailable": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z",
          "user": {
            "name": "HLV Nguyễn Văn Hùng",
            "phone": "0900000000"
          }
        },
        "ptPackage": {
          "id": 1,
          "name": "Combo 20 buổi",
          "code": "PT_20",
          "numberOfSessions": 20,
          "durationDays": 60,
          "goal": "MUSCLE_GAIN",
          "isActive": true,
          "createdAt": "2026-05-01T00:00:00.000Z",
          "updatedAt": "2026-05-01T00:00:00.000Z"
        },
        "payments": [
          {
            "id": 10,
            "user_id": 5,
            "membership_id": null,
            "plan_id": null,
            "coach_assignment_id": 1,
            "amount": "3000000",
            "method": "CASH",
            "status": "PAID",
            "transaction_ref": "CASH_CONFIRMED_BY_STAFF",
            "gateway_response": { "confirmedBy": "STAFF" },
            "paid_at": "2026-06-01T02:05:00.000Z",
            "created_at": "2026-06-01T02:00:00.000Z"
          }
        ]
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `FORBIDDEN` (403): không phải `ADMIN`/`STAFF`; `401`; `500`.
