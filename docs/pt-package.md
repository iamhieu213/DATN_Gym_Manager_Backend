# PT Package API

Base path: `/pt-package`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Quy ước chung của module

- **Xác thực:** `authMiddleware` áp dụng cho toàn bộ route. Thiếu/sai header `Authorization: Bearer <accessToken>` hoặc token không hợp lệ/hết hạn sẽ trả về (không có trường `success`):
  - `401` `{ "error": "Unauthorized" }` — thiếu header hoặc không phải dạng `Bearer <token>`.
  - `401` `{ "error": "Invalid token" }` — token sai, hết hạn hoặc payload không hợp lệ.
- **Phân quyền:** mọi API ghi (tạo, sửa, gán giá, mở/khóa) chỉ dành cho `ADMIN`. `STAFF` **không** có quyền quản trị ở module này (nhận `403 FORBIDDEN`). Với 2 API đọc, mọi role khác `ADMIN` (`USER`, `COACH`, `STAFF`) đều chỉ thấy dữ liệu đang hoạt động.
- **Định dạng lỗi:** module này chỉ trả `{ "success": false, "message": "..." }`, **không** có trường `error`. Mã lỗi (ví dụ `PACKAGE_NOT_FOUND`) dưới đây là mã nội bộ trong code, client nhận biết qua HTTP status và `message`.

| Mã nội bộ | HTTP | `message` |
| --- | --- | --- |
| `PACKAGE_NOT_FOUND` | 404 | Không tìm thấy gói tập PT mẫu yêu cầu. |
| `PACKAGE_CODE_ALREADY_EXISTS` | 400 | Mã gói PT này đã tồn tại trên hệ thống. Vui lòng chọn mã khác. |
| `MISSING_REQUIRED_FIELDS` | 400 | Vui lòng nhập đầy đủ các trường bắt buộc. |
| `COACH_PACKAGE_RELATION_NOT_FOUND` | 404 | PT này chưa được thiết lập giá cho gói tập tương ứng. |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện chức năng quản trị này. |
| (mọi lỗi khác, không được map) | 500 | Lỗi hệ thống. Vui lòng thử lại sau. |

Các lỗi không được map (trả `500`) gồm: `:id`/`:coachId` không phải số, `goal` không thuộc enum, thiếu `name`/`numberOfSessions`/`durationDays`/`goal` khi tạo gói, `coachId`/`ptPackageId` không tồn tại khi gán giá (vi phạm khóa ngoại), không gửi body ở API cần body, v.v.

---

## Enum `TrainingGoal`

- `WEIGHT_LOSS`: Giảm cân / Giảm mỡ
- `MUSCLE_GAIN`: Tăng cơ / Thể hình
- `COMPETITION_PREP`: Huấn luyện thi đấu chuyên nghiệp
- `REHABILITATION`: Phục hồi chấn thương / Trị liệu
- `GENERAL_FITNESS`: Duy trì vóc dáng / Sức khỏe tổng quát

---

## Kiểu dữ liệu Package (Gói tập PT mẫu)

Bảng `pt_packages`. Gói mẫu **không lưu giá**; giá bán do từng PT quy định qua bảng liên kết `CoachPtPackage` (xem bên dưới). Trường `code` là duy nhất (unique, tối đa 50 ký tự), `name` tối đa 255 ký tự.

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

## Kiểu dữ liệu CoachPtPackage (Giá bán riêng của PT cho một gói)

Bảng `coach_pt_packages`, khóa chính kép (`coachId`, `ptPackageId`). `coachId` là **id của hồ sơ PT (`coach_profiles.id`)**, không phải `userId`. `price` là `Decimal(12,2)` nên JSON trả về dạng **chuỗi**.

```json
{
  "coachId": 1,
  "ptPackageId": 1,
  "price": "3000000",
  "isActive": true
}
```

---

## GET `/pt-package`

Lấy danh sách các gói Combo PT mẫu có trong hệ thống.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Bảo mật trạng thái:** chỉ `ADMIN` được xem gói đã khóa. Mọi role khác (`USER`, `COACH`, `STAFF`) bị **ép** `isActive = true` (tham số `isActive` bị bỏ qua).
- **Query Parameters:**
  - `goal` (optional): Lọc theo mục tiêu tập luyện (`TrainingGoal`). Áp dụng cho mọi role. Không được validate: giá trị ngoài enum gây lỗi `500`. Chuỗi rỗng bị bỏ qua.
  - `isActive` (optional, chỉ có tác dụng với `ADMIN`): nếu có truyền thì `"true"` → chỉ gói đang hoạt động; **mọi giá trị khác** (kể cả `"false"`, `"1"`, chuỗi rỗng) → chỉ gói đã khóa. Không truyền → trả cả hai loại.
- **Không phân trang.** Kết quả sắp xếp theo `numberOfSessions` tăng dần.
- **Thành công `200`:** `data` là mảng Package (không có `message`, không có `meta`).
  ```json
  {
    "success": true,
    "data": [
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
    ]
  }
  ```
- **Lỗi thường gặp:** `401` (chưa đăng nhập), `500` (`goal` không hợp lệ).

---

## GET `/pt-package/:id/coaches`

Xem danh sách các Huấn luyện viên (PT) nhận dạy gói tập này, kèm theo giá bán riêng của từng PT và lịch rảnh.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Path Parameters:** `id` (number): id của gói PT mẫu.
- **Bảo mật dữ liệu:** Nếu gói tập không tồn tại, **hoặc** đang bị khóa (`isActive = false`) và người gọi không phải `ADMIN` (kể cả `STAFF`), hệ thống trả `404 PACKAGE_NOT_FOUND` để che giấu dữ liệu.
- **Điều kiện lọc luôn áp dụng (kể cả `ADMIN`):** chỉ trả các bản ghi `CoachPtPackage` có `isActive = true` **và** hồ sơ PT có `isAvailable = true`. Nghĩa là PT bị khóa quyền dạy gói (`.../coach/:coachId/deactivate`) hoặc PT đang tắt nhận khách sẽ không xuất hiện.
- **Query Parameters (Bộ lọc lịch làm việc rảnh, đều optional):**
  - `slots`: Chuỗi JSON mảng khung giờ, mỗi phần tử `{ "dayOfWeek": number, "startTime": "HH:mm", "endTime": "HH:mm" }`. PT phải thỏa **tất cả** các khung giờ trong mảng (điều kiện AND). Ví dụ (đã URL-encode khi gửi): `[{"dayOfWeek":1,"startTime":"18:00","endTime":"20:00"},{"dayOfWeek":3,"startTime":"18:00","endTime":"20:00"}]`.
  - `dayOfWeek`: Ngày trong tuần (0: Chủ Nhật, 1: Thứ 2, ..., 6: Thứ 7).
  - `startTime`: Giờ bắt đầu, dạng `HH:mm`, ví dụ `18:00`.
  - `endTime`: Giờ kết thúc, dạng `HH:mm`, ví dụ `20:00`.
  - **Quy tắc lọc:**
    - Nếu có `slots` thì dùng `slots` và **bỏ qua** bộ ba `dayOfWeek/startTime/endTime`.
    - Bộ ba `dayOfWeek` + `startTime` + `endTime` chỉ có tác dụng khi truyền **đủ cả ba**; thiếu một tham số thì bị bỏ qua (trả tất cả PT).
    - Một khung giờ được coi là khớp khi PT có một lịch rảnh cùng `dayOfWeek` và **bao trùm hoàn toàn** khung giờ yêu cầu (`startMinutes <= giờ bắt đầu` và `endMinutes >= giờ kết thúc`, tính theo số phút từ 00:00).
    - Nếu `slots` không phải JSON hợp lệ, không phải mảng, mảng rỗng, hoặc phần tử thiếu `startTime`/`endTime`, bộ lọc `slots` bị bỏ qua âm thầm (chỉ ghi log server), **không** trả lỗi.
- **Thành công `200`:** `data` là mảng bản ghi `CoachPtPackage` kèm thông tin PT. Không phân trang, không sắp xếp cố định. Trường `coach.availabilities` luôn là **toàn bộ** lịch rảnh của PT, không bị thu hẹp theo bộ lọc. Nếu không có PT nào phù hợp, `data` là `[]`.
  ```json
  {
    "success": true,
    "data": [
      {
        "coachId": 1,
        "ptPackageId": 1,
        "price": "3000000",
        "isActive": true,
        "coach": {
          "id": 1,
          "userId": 5,
          "speciality": "Thể hình / Tăng cơ",
          "bio": "10 năm kinh nghiệm",
          "isAvailable": true,
          "createdAt": "2026-06-01T00:00:00.000Z",
          "updatedAt": "2026-06-01T00:00:00.000Z",
          "user": {
            "name": "HLV Nguyễn Văn Hùng",
            "avatarUrl": null,
            "email": "coach@example.com",
            "phone": "0900000001"
          },
          "availabilities": [
            {
              "id": 1,
              "coachId": 1,
              "dayOfWeek": 1,
              "startTime": "18:00",
              "endTime": "20:00",
              "startMinutes": 1080,
              "endMinutes": 1200
            }
          ]
        }
      }
    ]
  }
  ```
- **Lỗi thường gặp:**
  - `PACKAGE_NOT_FOUND` (404): gói không tồn tại, hoặc bị khóa với người gọi không phải `ADMIN`.
  - `500`: `id` không phải số. Các tham số lọc lịch không được validate (ví dụ `dayOfWeek` phải là số nguyên, `startTime`/`endTime` phải đúng dạng `HH:mm`); giá trị sai định dạng có thể cho kết quả rỗng hoặc lỗi.

---

## POST `/pt-package`

Tạo mới một gói Combo PT mẫu trong hệ thống.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Request Body:**
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
  - `code` (string, bắt buộc, duy nhất): Mã gói. Đây là trường duy nhất được kiểm tra rõ ràng; thiếu/rỗng `code` → `MISSING_REQUIRED_FIELDS`.
  - `name` (string, bắt buộc), `numberOfSessions` (number, bắt buộc), `durationDays` (number, bắt buộc, số ngày hiệu lực), `goal` (`TrainingGoal`, bắt buộc): **không** được kiểm tra ở service; thiếu hoặc sai kiểu thì Prisma báo lỗi và API trả `500`.
  - `isActive` (boolean, optional): mặc định `true`.
  - Các trường khác trong body bị bỏ qua. Không có validate giá trị (ví dụ số âm) ở tầng code.
- **Thành công `201`:**
  ```json
  {
    "success": true,
    "message": "Tạo gói PT mẫu thành công.",
    "data": {
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
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): không phải `ADMIN`.
  - `MISSING_REQUIRED_FIELDS` (400): thiếu `code`.
  - `PACKAGE_CODE_ALREADY_EXISTS` (400): `code` đã tồn tại.
  - `500`: thiếu/sai `name`, `numberOfSessions`, `durationDays`, `goal`; không gửi body.

---

## PUT `/pt-package/:id`

Cập nhật thông tin gói Combo PT mẫu (cập nhật một phần, dù dùng method `PUT`).

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:** `id` (number): id gói PT mẫu.
- **Request Body:** Gửi các trường cần cập nhật, tất cả đều optional; trường không gửi (hoặc `undefined`) được giữ nguyên:
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
  - Chỉ các trường trên được cập nhật; trường khác bị bỏ qua.
  - Nếu đổi `code` sang giá trị khác `code` hiện tại thì hệ thống kiểm tra trùng với gói khác.
  - `goal` không thuộc enum → `500`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Cập nhật gói PT mẫu thành công.",
    "data": {
      "id": 1,
      "name": "Combo 20 buổi",
      "code": "PT_20",
      "numberOfSessions": 20,
      "durationDays": 60,
      "goal": "MUSCLE_GAIN",
      "isActive": true,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-02T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): không phải `ADMIN`.
  - `PACKAGE_NOT_FOUND` (404): không có gói với `id` này.
  - `PACKAGE_CODE_ALREADY_EXISTS` (400): `code` mới đã thuộc gói khác.
  - `500`: `id` không phải số, `goal` không hợp lệ, không gửi body.

---

## POST `/pt-package/set-price`

Admin thiết lập giá bán riêng cho từng Huấn luyện viên (PT) đối với một gói tập cụ thể. Thao tác là **upsert** trên khóa (`coachId`, `ptPackageId`): chưa có thì tạo mới, đã có thì cập nhật giá.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Request Body:**
  ```json
  {
    "coachId": 1,
    "ptPackageId": 1,
    "price": 3000000
  }
  ```
  - `coachId` (number, bắt buộc): id hồ sơ PT (`coach_profiles.id`), không phải `userId`.
  - `ptPackageId` (number, bắt buộc): id gói PT mẫu.
  - `price` (number, bắt buộc): giá bán của PT cho gói này, lưu dạng `Decimal(12,2)`.
  - Service **không validate** body và **không** kiểm tra gói/PT có tồn tại trước (không có `PACKAGE_NOT_FOUND`/`MISSING_REQUIRED_FIELDS` ở API này). Thiếu trường hoặc `coachId`/`ptPackageId` không tồn tại → lỗi Prisma → `500`.
- **Hiệu ứng phụ:** cả khi tạo mới lẫn cập nhật, bản ghi luôn được đặt `isActive = true` (nghĩa là gọi lại `set-price` sẽ **kích hoạt lại** quyền dạy của PT nếu trước đó đã bị khóa bằng `.../coach/:coachId/deactivate`).
- **Thành công `200`:** `data` là bản ghi `CoachPtPackage`.
  ```json
  {
    "success": true,
    "message": "Cài đặt bảng giá PT thành công.",
    "data": {
      "coachId": 1,
      "ptPackageId": 1,
      "price": "3000000",
      "isActive": true
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): không phải `ADMIN`.
  - `500`: thiếu trường bắt buộc, `coachId`/`ptPackageId` không tồn tại, không gửi body.

---

## PATCH `/pt-package/:id/activate`

Mở hoạt động gói Combo PT mẫu toàn hệ thống (đặt `isActive = true`). Thao tác idempotent; chỉ đổi cờ `isActive` của gói, **không** thay đổi các bản ghi `CoachPtPackage` (giá/quyền dạy từng PT).

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:** `id` (number): id gói PT mẫu.
- **Thành công `200`** (không có `data`):
  ```json
  {
    "success": true,
    "message": "Mở hoạt động gói PT thành công."
  }
  ```
- **Lỗi thường gặp:** `FORBIDDEN` (403), `PACKAGE_NOT_FOUND` (404), `500` (`id` không phải số).

---

## PATCH `/pt-package/:id/deactivate`

Khóa hoạt động gói Combo PT mẫu toàn hệ thống (đặt `isActive = false`). Sau khi khóa, gói biến mất khỏi `GET /pt-package` và `GET /pt-package/:id/coaches` (trả `404`) đối với mọi role không phải `ADMIN`. Chỉ đổi cờ của gói, không thay đổi `CoachPtPackage`.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:** `id` (number): id gói PT mẫu.
- **Thành công `200`** (không có `data`):
  ```json
  {
    "success": true,
    "message": "Khóa hoạt động gói PT thành công."
  }
  ```
- **Lỗi thường gặp:** `FORBIDDEN` (403), `PACKAGE_NOT_FOUND` (404), `500` (`id` không phải số).

---

## PATCH `/pt-package/:id/coach/:coachId/activate`

Kích hoạt lại quyền dạy gói Combo PT cụ thể cho một Huấn luyện viên (PT) (đặt `CoachPtPackage.isActive = true`). Không thay đổi `price`.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:**
  - `id` (number): id gói PT mẫu.
  - `coachId` (number): id hồ sơ PT (`coach_profiles.id`).
- **Thành công `200`** (không có `data`):
  ```json
  {
    "success": true,
    "message": "Kích hoạt quyền dạy gói tập cho PT thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): không phải `ADMIN`.
  - `PACKAGE_NOT_FOUND` (404): gói `id` không tồn tại (gói đang bị khóa vẫn được phép thao tác).
  - `COACH_PACKAGE_RELATION_NOT_FOUND` (404): PT chưa được thiết lập giá cho gói này (chưa gọi `set-price`).
  - `500`: `id`/`coachId` không phải số.

---

## PATCH `/pt-package/:id/coach/:coachId/deactivate`

Khóa/ngừng quyền dạy gói Combo PT cụ thể của một Huấn luyện viên (PT) (đặt `CoachPtPackage.isActive = false`). Sau khi khóa, PT không còn xuất hiện trong `GET /pt-package/:id/coaches`. Giá đã thiết lập được giữ nguyên.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF` nhận `403`).
- **Path Parameters:**
  - `id` (number): id gói PT mẫu.
  - `coachId` (number): id hồ sơ PT (`coach_profiles.id`).
- **Thành công `200`** (không có `data`):
  ```json
  {
    "success": true,
    "message": "Khóa quyền dạy gói tập của PT thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): không phải `ADMIN`.
  - `PACKAGE_NOT_FOUND` (404): gói `id` không tồn tại.
  - `COACH_PACKAGE_RELATION_NOT_FOUND` (404): PT chưa được thiết lập giá cho gói này.
  - `500`: `id`/`coachId` không phải số.
