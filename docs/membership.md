# Membership API

Base path: `/membership`

Tất cả API trong module này cần Bearer token.

## Quy ước chung của module

- **Xác thực:** `authMiddleware` áp dụng cho toàn bộ route. Thiếu/sai header `Authorization: Bearer <accessToken>` hoặc token không hợp lệ/hết hạn sẽ trả về (không có trường `success`):
  - `401` `{ "error": "Unauthorized" }` — thiếu header hoặc không phải dạng `Bearer <token>`.
  - `401` `{ "error": "Invalid token" }` — token sai, hết hạn hoặc payload không hợp lệ.
- **Phân quyền:** 4 API của hội viên (`buy`, `upgrade`, `active`, `my-history`) không kiểm tra role, mọi tài khoản đã đăng nhập đều gọi được và luôn thao tác trên dữ liệu của chính mình (`userId` lấy từ token). `GET /membership` dành cho `ADMIN`/`STAFF`; `POST /membership/:id/cancel` chỉ dành cho `ADMIN`.
- **Định dạng lỗi:** `{ "success": false, "message": "...", "error": "MÃ_LỖI" }`.

| `error` | HTTP | `message` |
| --- | --- | --- |
| `UNAUTHORIZED` | 401 | Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. (chỉ khi token không mang thông tin user; thực tế bị `authMiddleware` chặn trước) |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện chức năng này. |
| `PLAN_NOT_FOUND` | 404 | Gói tập không hợp lệ hoặc đã ngừng hoạt động. |
| `MEMBERSHIP_NOT_FOUND` | 404 | Không tìm thấy đăng ký gói tập. |
| `ALREADY_HAVE_ACTIVE_PLAN` | 400 | Bạn đã có gói tập đang hoạt động. Vui lòng chọn nâng cấp gói nếu muốn thay đổi. |
| `NO_ACTIVE_PLAN_TO_UPGRADE` | 400 | Không tìm thấy gói tập đang hoạt động nào để thực hiện nâng cấp. |
| `CANNOT_DOWNGRADE_OR_EQUAL` | 400 | Chỉ được nâng cấp lên các gói tập có giá trị lớn hơn gói hiện tại. |
| `MEMBERSHIP_NOT_ACTIVE` | 400 | Gói tập này hiện không ở trạng thái kích hoạt. |
| `BAD_REQUEST` | 400 | ID gói đăng ký không hợp lệ. (khi `:id` của `cancel` không phải số) |
| (lỗi khác, không được map) | 500 | Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau. — trường `error` chứa nội dung thông báo lỗi gốc thay vì một mã cố định |

Controller còn map `PAYMENT_NOT_FOUND` (404) và `PAYMENT_ALREADY_PROCESSED` (400) nhưng 2 mã này chỉ phát sinh ở luồng xác nhận thanh toán (`MembershipsService.confirmPayment`, được gọi từ module `payments`, xem `payments.md`), không phải từ 6 API dưới đây.

Các lỗi trả `500` gồm: không gửi body hoặc thiếu `planId`/`newPlanId`/`paymentMethod`, `paymentMethod` không thuộc enum, `status` (ở `GET /membership`) không thuộc `MembershipStatus`, `page`/`limit` không hợp lệ, vì bị Prisma từ chối.

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- `MembershipStatus`: `ACTIVE`, `EXPIRED`, `CANCELLED`, `PENDING`, `UPGRADED`
- `PaymentStatus`: `PENDING`, `PAID`, `FAILED`, `REFUNDED`

## Kiểu dữ liệu Membership

Bảng `memberships`, tên trường snake_case. `start_date`/`end_date` là cột kiểu `DATE` (chỉ có ngày) nên JSON trả về lúc `00:00:00.000Z`. `plan.price` là `Decimal` nên trả về dạng chuỗi.

```json
{
  "id": 1,
  "user_id": 5,
  "plan_id": 1,
  "start_date": "2026-06-01T00:00:00.000Z",
  "end_date": "2026-07-01T00:00:00.000Z",
  "status": "ACTIVE",
  "is_active": true,
  "created_at": "2026-06-01T08:00:00.000Z",
  "updated_at": "2026-06-01T08:30:00.000Z"
}
```

Tùy API, object này được kèm `plan` (đủ các trường của Plan, xem `plans.md`), `payments` hoặc `user`.

## Vòng đời trạng thái (`MembershipStatus`)

| Trạng thái | `is_active` | Được đặt khi |
| --- | --- | --- |
| `PENDING` | `false` | `POST /membership/buy` hoặc `POST /membership/upgrade` tạo đăng ký mới, đang chờ thanh toán. |
| `ACTIVE` | `true` | Hóa đơn (Payment) của đăng ký được xác nhận thanh toán (`MembershipsService.confirmPayment`, kích hoạt qua `POST /payments/:paymentId/confirm` của `ADMIN`/`STAFF`, xem `payments.md`). Payment chuyển `PAID`, đồng thời ghi Redis cache. `confirmPayment` chỉ chấp nhận role `ADMIN`/`STAFF`, role khác (kể cả `SYSTEM` mà webhook VNPAY truyền vào) bị `FORBIDDEN`. |
| `UPGRADED` | `false` | Khi một đăng ký mới được kích hoạt mà user còn đăng ký `ACTIVE` khác, đăng ký cũ đó chuyển `UPGRADED` và `end_date` bị đặt về thời điểm kích hoạt (kết thúc sớm). |
| `CANCELLED` | `false` | `POST /membership/:id/cancel` (chỉ áp dụng cho đăng ký đang `ACTIVE`). |
| `EXPIRED` | — | Có trong enum nhưng **không có đoạn code nào trong `src/` tự chuyển sang `EXPIRED`** (chỉ script seed dùng). Hết hạn `end_date` không làm `status` tự đổi. |

Các quy tắc liên quan tới đăng ký còn `PENDING`:

- Cron dọn dẹp (`src/services/cron.service.ts`, chạy mỗi 1 phút): các hóa đơn `PENDING` có `method` là `VNPAY`, `MOMO` hoặc `BANK_TRANSFER` được tạo quá 15 phút sẽ được đặt `FAILED` rồi Membership tương ứng bị **xóa cứng** (theo schema, Payment gắn với membership có `ON DELETE CASCADE`, nên hóa đơn đó cũng bị xóa theo). Hóa đơn `CASH` không bị cron quét.
- Các check "đang có gói" (`ALREADY_HAVE_ACTIVE_PLAN`, `NO_ACTIVE_PLAN_TO_UPGRADE`, `GET /membership/active`) chỉ xét đăng ký có `status = ACTIVE` **và** `is_active = true`; đăng ký `PENDING` không bị tính.
- Các check trên và `GET /membership/active` **không** kiểm tra `end_date`: đăng ký quá hạn nhưng chưa bị hủy/thay thế vẫn còn `ACTIVE`.

## POST `/membership/buy`

Đăng ký mua gói tập mới. Tạo Membership `PENDING` và Payment `PENDING` (trong cùng một transaction); gói chỉ được kích hoạt khi hóa đơn được thanh toán/xác nhận.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (không kiểm tra role).
- **Request Body:**
  ```json
  {
    "planId": 1,
    "paymentMethod": "CASH"
  }
  ```
  - `planId` (number, bắt buộc): id gói tập (`/plan`). Thiếu hoặc sai kiểu → lỗi `500`.
  - `paymentMethod` (`PaymentMethod`, bắt buộc): `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`. Không được validate ở controller/service; giá trị sai hoặc thiếu làm transaction thất bại (không tạo gì) và trả `500`.
- **Luồng xử lý:**
  1. Gói (`planId`) phải tồn tại và `is_active = true`, ngược lại `PLAN_NOT_FOUND`.
  2. User không được có đăng ký `ACTIVE` (`is_active = true`), ngược lại `ALREADY_HAVE_ACTIVE_PLAN`. Đăng ký `PENDING` không chặn, tức user có thể gọi `buy` nhiều lần và tạo nhiều đơn `PENDING`.
  3. `start_date` = ngày hiện tại của server; `end_date` = ngày hiện tại cộng `plan.duration_days` ngày.
  4. Transaction: tạo Membership (`status = PENDING`, `is_active = false`) và Payment (`status = PENDING`, `amount` = `plan.price` tại thời điểm mua, `method` = `paymentMethod`, `plan_id`, `membership_id`).
  5. Phát sự kiện `membership.registered` (xem mục Sự kiện & thông báo).
- **Thành công `201`:**
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
  `amount` là chuỗi (Decimal); `status` là trạng thái của Payment (luôn `PENDING`).
- **Lỗi thường gặp:**
  - `PLAN_NOT_FOUND` (404): Gói không tồn tại hoặc đã bị khóa (`is_active = false`).
  - `ALREADY_HAVE_ACTIVE_PLAN` (400): User đã có gói `ACTIVE`.
  - `500`: thiếu/sai `planId` hoặc `paymentMethod`, không gửi body.

## POST `/membership/upgrade`

Nâng cấp gói tập đang active lên gói có giá cao hơn. Hội viên chỉ phải trả phần chênh lệch sau khi trừ giá trị còn lại của gói cũ. Gói cũ vẫn `ACTIVE` cho tới khi hóa đơn nâng cấp được xác nhận thanh toán.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (không kiểm tra role).
- **Request Body:**
  ```json
  {
    "newPlanId": 2,
    "paymentMethod": "VNPAY"
  }
  ```
  - `newPlanId` (number, bắt buộc): id gói muốn nâng cấp lên.
  - `paymentMethod` (`PaymentMethod`, bắt buộc): như `buy`, không được validate (sai/thiếu → `500`).
- **Thứ tự kiểm tra:**
  1. Gói mới phải tồn tại và `is_active = true`, ngược lại `PLAN_NOT_FOUND`.
  2. User phải có đăng ký `ACTIVE` (`is_active = true`), ngược lại `NO_ACTIVE_PLAN_TO_UPGRADE`.
  3. `newPlan.price` phải **lớn hơn hẳn** `plan.price` của gói đang dùng, ngược lại `CANNOT_DOWNGRADE_OR_EQUAL` (kể cả nâng cấp lên chính gói đang dùng). So sánh dùng giá niêm yết hiện tại của hai gói.
- **Công thức tính tiền** (ngày được làm tròn về 00:00 theo múi giờ của server; `1 ngày = 86 400 000 ms`):
  ```text
  totalDays           = round((startOfDay(end_date) - startOfDay(start_date)) / 1 ngày)   // của gói đang ACTIVE
  remainingDays       = round((startOfDay(end_date) - startOfDay(hôm nay)) / 1 ngày)
  remainingDaysCapped = max(0, min(totalDays, remainingDays))
  remainingValue      = totalDays > 0 ? remainingDaysCapped / totalDays * plan.price : 0   // plan.price = giá niêm yết hiện tại của gói cũ
  amountToPay         = max(0, newPlan.price - remainingValue)
  Payment.amount      = round(amountToPay)        // số nguyên
  data.remainingValue = round(remainingValue)     // số nguyên
  ```
  Ví dụ: gói cũ 500 000 đ, 30 ngày, còn 20 ngày → `remainingValue = 20/30 * 500000 = 333333.33` (trả về `333333`); nâng cấp lên gói 1 200 000 đ → `amountToPay = 866666.67` → `Payment.amount = 866667`.
- **Ghi dữ liệu (transaction):** tạo Membership mới cho gói mới với `status = PENDING`, `is_active = false`, `start_date` = hôm nay, `end_date` = hôm nay + `newPlan.duration_days` ngày (**không** cộng dồn số ngày còn lại của gói cũ) và Payment `PENDING` (`amount` = số tiền chênh lệch, `plan_id` = gói mới, `membership_id` = membership mới). Gói cũ **chưa** bị thay đổi ở bước này; khi hóa đơn được xác nhận thanh toán, gói cũ chuyển `UPGRADED` (`is_active = false`, `end_date` = ngày xác nhận) và gói mới thành `ACTIVE`. Không có kiểm tra chặn tạo nhiều yêu cầu nâng cấp `PENDING`.
- **Thành công `200`** (lưu ý mã `200`, không phải `201`):
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
  `membershipId` là id của Membership **mới** (đang `PENDING`). `amount` là chuỗi (Decimal); `remainingValue` là số nguyên (number). `status` là trạng thái Payment.
- **Lỗi thường gặp:**
  - `PLAN_NOT_FOUND` (404): Gói mới không tồn tại hoặc đã bị khóa.
  - `NO_ACTIVE_PLAN_TO_UPGRADE` (400): User không có gói `ACTIVE`.
  - `CANNOT_DOWNGRADE_OR_EQUAL` (400): Gói mới không đắt hơn gói hiện tại.
  - `500`: thiếu/sai `newPlanId` hoặc `paymentMethod`, không gửi body.
- **Sự kiện:** phát `membership.upgraded` sau khi transaction thành công.

## GET `/membership/active`

Lấy gói tập active hiện tại của chính user đăng nhập. API **luôn đọc trực tiếp từ database** (không đọc, không ghi Redis), nên response luôn có cùng một dạng đầy đủ.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Luồng xử lý:** truy vấn Membership đầu tiên (`findFirst`, không có `orderBy`) có `user_id` = user đăng nhập, `is_active = true`, `status = ACTIVE`, kèm `plan`. Không kiểm tra `end_date`.
- **Thành công `200`:** luôn là HTTP `200` với cùng `message`. `data` là **raw Membership row (snake_case) kèm `plan`**, hoặc `null` nếu không có gói active (`data: null`, không phải `404`).

  Khi có gói active:
  ```json
  {
    "success": true,
    "message": "Lấy thông tin gói tập hiện tại thành công.",
    "data": {
      "id": 1,
      "user_id": 5,
      "plan_id": 1,
      "start_date": "2026-06-01T00:00:00.000Z",
      "end_date": "2026-07-01T00:00:00.000Z",
      "status": "ACTIVE",
      "is_active": true,
      "created_at": "2026-06-01T08:00:00.000Z",
      "updated_at": "2026-06-01T08:30:00.000Z",
      "plan": {
        "id": 1,
        "name": "Gói 1 tháng",
        "code": "PLAN_1M",
        "description": "Mô tả gói tập",
        "price": "500000",
        "duration_days": 30,
        "features": ["Tập không giới hạn", "Nước uống miễn phí"],
        "is_active": true,
        "created_at": "2026-06-01T00:00:00.000Z",
        "updated_at": "2026-06-01T00:00:00.000Z"
      }
    }
  }
  ```

  Khi không có gói active:
  ```json
  {
    "success": true,
    "message": "Lấy thông tin gói tập hiện tại thành công.",
    "data": null
  }
  ```
- **Không dùng Redis:** key `membership:active:<userId>` chỉ phục vụ check-in (dạng rút gọn, xem mục Redis cache bên dưới và `check-in.md`), API này không đọc cũng không ghi key đó.
- **Lỗi thường gặp:** `401` (chưa đăng nhập), `500` (lỗi hệ thống).

## GET `/membership/my-history`

Lấy lịch sử mua gói của chính user đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Không phân trang, không có query.** Trả toàn bộ đăng ký của user (mọi `status`), sắp xếp `created_at` giảm dần. Mỗi phần tử kèm `plan` (đủ trường Plan) và `payments` (mảng các Payment của đăng ký đó, đủ trường, gồm cả `gateway_response`). Đăng ký online quá 15 phút chưa thanh toán đã bị cron xóa nên không còn trong lịch sử.
- **Thành công `200`:** `data` là mảng Membership (rỗng `[]` nếu chưa có).
  ```json
  {
    "success": true,
    "message": "Lấy lịch sử mua gói tập thành công.",
    "data": [
      {
        "id": 1,
        "user_id": 5,
        "plan_id": 1,
        "start_date": "2026-06-01T00:00:00.000Z",
        "end_date": "2026-07-01T00:00:00.000Z",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2026-06-01T08:00:00.000Z",
        "updated_at": "2026-06-01T08:30:00.000Z",
        "plan": {
          "id": 1,
          "name": "Gói 1 tháng",
          "code": "PLAN_1M",
          "description": "Mô tả gói tập",
          "price": "500000",
          "duration_days": 30,
          "features": ["Tập không giới hạn"],
          "is_active": true,
          "created_at": "2026-06-01T00:00:00.000Z",
          "updated_at": "2026-06-01T00:00:00.000Z"
        },
        "payments": [
          {
            "id": 10,
            "user_id": 5,
            "membership_id": 1,
            "plan_id": 1,
            "coach_assignment_id": null,
            "amount": "500000",
            "method": "CASH",
            "status": "PAID",
            "transaction_ref": "CASH_CONFIRMED_BY_ADMIN",
            "gateway_response": { "confirmedBy": "ADMIN" },
            "paid_at": "2026-06-01T08:30:00.000Z",
            "created_at": "2026-06-01T08:00:00.000Z"
          }
        ]
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `401` (chưa đăng nhập), `500` (lỗi hệ thống).

## GET `/membership`

Admin/staff xem danh sách đăng ký gói tập của toàn hệ thống (có phân trang, tìm kiếm, lọc trạng thái).

- **Quyền hạn:** `ADMIN`, `STAFF` (cả hai thấy toàn bộ dữ liệu như nhau). Role khác → `FORBIDDEN` (403).
- **Query Parameters:**
  - `page` (optional): Trang, mặc định `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`. **Không có giới hạn tối đa.**
  - `status` (optional): Lọc theo `MembershipStatus` (`ACTIVE`, `EXPIRED`, `CANCELLED`, `PENDING`, `UPGRADED`). Chuỗi rỗng bị bỏ qua; giá trị ngoài enum gây lỗi `500`.
  - `search` (optional): Tìm không phân biệt hoa thường, chứa chuỗi trong `name`, `email` **hoặc** `phone` của user.
  - `page`/`limit` được đổi bằng `Number(...)` mà không validate; giá trị không hợp lệ gây lỗi `500`.
- **Sắp xếp:** `created_at` giảm dần.
- **Thành công `200`:** `data` là mảng Membership kèm `user` (`id`, `name`, `email`, `phone`) và `plan` (chỉ `id`, `name`, `price`, `duration_days`), `meta` là phân trang (`totalPages = ceil(total / limit)`).
  ```json
  {
    "success": true,
    "message": "Lấy danh sách đăng ký gói tập thành công.",
    "data": [
      {
        "id": 1,
        "user_id": 5,
        "plan_id": 1,
        "start_date": "2026-06-01T00:00:00.000Z",
        "end_date": "2026-07-01T00:00:00.000Z",
        "status": "ACTIVE",
        "is_active": true,
        "created_at": "2026-06-01T08:00:00.000Z",
        "updated_at": "2026-06-01T08:30:00.000Z",
        "user": {
          "id": 5,
          "name": "Nguyen Van A",
          "email": "a@example.com",
          "phone": "0900000000"
        },
        "plan": {
          "id": 1,
          "name": "Gói 1 tháng",
          "price": "500000",
          "duration_days": 30
        }
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
- **Lỗi thường gặp:** `FORBIDDEN` (403), `500` (`status`/`page`/`limit` không hợp lệ).

## POST `/membership/:id/cancel`

Admin hủy gói tập đang active của hội viên.

- **Quyền hạn:** Chỉ `ADMIN` (kiểm tra ở service). `STAFF` và các role khác nhận `FORBIDDEN` (403).
- **Path Parameters:** `id` (number): id Membership cần hủy. Không cần body (API không đọc lý do hủy).
- **Thứ tự kiểm tra:** `id` là số (`BAD_REQUEST`) → quyền (`FORBIDDEN`) → tồn tại (`MEMBERSHIP_NOT_FOUND`) → `status` phải là `ACTIVE` (`MEMBERSHIP_NOT_ACTIVE`). Các đăng ký `PENDING`, `EXPIRED`, `CANCELLED`, `UPGRADED` không hủy được.
- **Hiệu ứng phụ:**
  - Membership: `status = CANCELLED`, `is_active = false` (`end_date` giữ nguyên).
  - Payment liên quan **không bị thay đổi** (không hoàn tiền, không đổi trạng thái).
  - Xóa Redis key `membership:active:<user_id>` của hội viên (key này chỉ do check-in đọc, nên lần check-in kế tiếp sẽ đọc lại từ database; `GET /membership/active` vốn luôn đọc database).
  - Phát sự kiện `membership.cancelled_by_admin` để gửi thông báo cho hội viên.
- **Thành công `200`:** `data` là Membership sau khi hủy (chỉ các trường của bảng, **không** kèm `plan`/`user`).
  ```json
  {
    "success": true,
    "message": "Hủy gói tập của hội viên thành công.",
    "data": {
      "id": 1,
      "user_id": 5,
      "plan_id": 1,
      "start_date": "2026-06-01T00:00:00.000Z",
      "end_date": "2026-07-01T00:00:00.000Z",
      "status": "CANCELLED",
      "is_active": false,
      "created_at": "2026-06-01T08:00:00.000Z",
      "updated_at": "2026-06-10T09:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): `id` không phải số (`"ID gói đăng ký không hợp lệ."`).
  - `FORBIDDEN` (403): Không phải `ADMIN`.
  - `MEMBERSHIP_NOT_FOUND` (404): Không tìm thấy đăng ký.
  - `MEMBERSHIP_NOT_ACTIVE` (400): Đăng ký không ở trạng thái `ACTIVE`.

## Redis cache `membership:active:<userId>`

Key này **không được `GET /membership/active` sử dụng**; nó chỉ phục vụ điểm danh (check-in) và được module membership ghi/xóa như sau.

- **Key đầy đủ:** `<REDIS_KEY_PREFIX>membership:active:<userId>`; prefix lấy từ biến môi trường `REDIS_KEY_PREFIX`, mặc định `hipu-hrm:dev:` (ví dụ `hipu-hrm:dev:membership:active:5`). Nếu `REDIS_ENABLED=false` thì đọc luôn trả rỗng, ghi/xóa không làm gì.
- **Giá trị:** chuỗi JSON dạng **rút gọn camelCase** (khác dạng đầy đủ snake_case của `GET /membership/active`):
  ```json
  {
    "membershipId": 1,
    "planId": 1,
    "planName": "Gói 1 tháng",
    "startDate": "2026-06-01T00:00:00.000Z",
    "endDate": "2026-07-01T00:00:00.000Z"
  }
  ```
- **TTL:** `floor((end_date - hiện tại) / 1000)` giây, tức tới hạn `end_date` của gói; chỉ ghi khi TTL > 0.
- **Nơi ghi/xóa:**

  | Nơi | Thao tác |
  | --- | --- |
  | `MembershipsService.confirmPayment` (xác nhận thanh toán, kích hoạt đăng ký; gọi từ module `payments`) | ghi (ghi đè) dạng rút gọn ở trên, TTL tới `end_date` của đăng ký vừa kích hoạt |
  | `POST /membership/:id/cancel` | xóa |
  | `POST /check-in` (ở module check-in, khi cache miss) | ghi dạng rút gọn tương tự |

- **Nơi đọc:** chỉ `POST /check-in` (xem `check-in.md`).

## Sự kiện & thông báo

Các sự kiện phát bằng `eventEmitter` sau khi ghi database thành công (fire-and-forget: API không chờ listener). Listener lưu Notification vào database và đẩy realtime qua socket sự kiện `new_notification` tới user nhận.

| Sự kiện | Phát bởi | Payload | Thông báo được tạo |
| --- | --- | --- | --- |
| `membership.registered` | `POST /membership/buy` | `userId`, `membershipId`, `planName`, `durationDays`, `amount`, `method` | Cho hội viên: "Đơn đăng ký gói tập thành công" (type `PAYMENT_PENDING`, `referenceId` = membershipId). Nếu `method = CASH`: thêm thông báo "Đơn mua gói tập chờ thu tiền mặt" cho mọi `ADMIN`/`STAFF` có `status = ACTIVE`. |
| `membership.upgraded` | `POST /membership/upgrade` | `userId`, `membershipId` (membership mới), `newPlanName`, `amount`, `method` | Cho hội viên: "Yêu cầu nâng cấp gói tập" (type `PAYMENT_PENDING`, `referenceId` = membershipId). Nếu `method = CASH`: thêm "Yêu cầu nâng cấp gói chờ thu tiền" cho mọi `ADMIN`/`STAFF` `ACTIVE`. |
| `membership.cancelled_by_admin` | `POST /membership/:id/cancel` | `userId`, `planId` | Cho hội viên: "Gói tập của bạn đã bị hủy" (type `SESSION_CANCELLED`, không có `referenceId`). |

Khi hóa đơn được xác nhận thanh toán, sự kiện `payment.success` do module `payments` phát (không thuộc module này).
