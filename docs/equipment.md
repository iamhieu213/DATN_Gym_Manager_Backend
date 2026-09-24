# Equipment API

Base path: `/equipment`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

Module này không phát sự kiện (event), không gửi thông báo và không dùng Redis. Mọi thao tác chỉ ghi vào database (bảng `equipments`, `maintenance_tasks`).

---

## Enum liên quan

### `EquipmentStatus`

- `OPERATIONAL`: Hoạt động tốt
- `UNDER_MAINTENANCE`: Đang bảo trì
- `OUT_OF_SERVICE`: Hỏng / Ngừng hoạt động

### `MaintenancePriority` (độ ưu tiên lịch bảo trì)

- `CRITICAL`: Khẩn cấp
- `ROUTINE`: Định kỳ
- `NORMAL`: Bình thường (mặc định của database khi không truyền `priority`)

### `MaintenanceStatus` (trạng thái lịch bảo trì)

- `PENDING`: Chờ thực hiện (mặc định khi tạo lịch)
- `IN_PROGRESS`: Đang tiến hành
- `COMPLETED`: Đã hoàn thành
- `CANCELLED`: Đã hủy

---

## Kiểu dữ liệu Equipment

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

- `code` là duy nhất trong toàn hệ thống (unique).
- `location` có trong database nhưng **không có API nào của module này ghi giá trị cho trường này** (tạo mới luôn để `null`, các API cập nhật không nhận `location`).

## Kiểu dữ liệu MaintenanceTask

```json
{
  "id": 1,
  "equipmentId": 1,
  "title": "Bảo dưỡng xích tạ máy kéo lưng sảnh A",
  "description": "Cân chỉnh dây cáp và bôi dầu bôi trơn chuyên dụng",
  "scheduledAt": "2026-06-25T00:00:00.000Z",
  "completedAt": null,
  "priority": "NORMAL",
  "status": "PENDING",
  "assignedTeam": "Đội Kỹ thuật sảnh A",
  "cost": null,
  "notes": null,
  "createdAt": "2026-06-24T00:00:00.000Z",
  "updatedAt": "2026-06-24T00:00:00.000Z"
}
```

- `cost` là kiểu Decimal nên khi có giá trị được trả về dạng chuỗi (ví dụ `"150000"`).
- Khi xóa thiết bị, toàn bộ lịch bảo trì của thiết bị đó bị xóa theo (khóa ngoại `onDelete: Cascade`).

---

## Định dạng lỗi

Lỗi do controller/service trả về luôn có dạng (không có trường `error`):

```json
{
  "success": false,
  "message": "Không tìm thấy thiết bị."
}
```

Bảng ánh xạ mã lỗi nội bộ sang HTTP status (hàm `mapError` trong `equipment.controller.ts`):

| Mã lỗi | HTTP | `message` |
| --- | --- | --- |
| `EQUIPMENT_NOT_FOUND` | 404 | Không tìm thấy thiết bị. |
| `MAINTENANCE_TASK_NOT_FOUND` | 404 | Không tìm thấy lịch bảo trì. |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện hành động này. |
| `INVALID_QUANTITY` | 400 | Số lượng thiết bị phải lớn hơn 0. |
| `BAD_REQUEST` | 400 | Yêu cầu không hợp lệ. |
| (mọi lỗi khác, ví dụ lỗi Prisma khi dữ liệu sai kiểu/sai enum/sai khóa ngoại) | 500 | Lỗi máy chủ. Vui lòng thử lại sau. |

Lỗi xác thực do `authMiddleware` (áp dụng cho mọi route của module, trả trước khi vào controller):

- `401` `{ "error": "Unauthorized" }`: thiếu header `Authorization: Bearer <token>`.
- `401` `{ "error": "Invalid token" }`: token không hợp lệ hoặc hết hạn.

Lưu ý chung: module **không validate kiểu dữ liệu ở tầng request** (không có schema validator). Các trường sai kiểu, sai enum, ngày không hợp lệ hoặc khóa ngoại không tồn tại sẽ làm Prisma ném lỗi và trả `500`, trừ những trường hợp được liệt kê rõ là `400` bên dưới.

---

## POST `/equipment`

Tạo mới hàng loạt thiết bị phòng gym, mã thiết bị tự động được sinh tăng dần dựa trên `baseCode`.

- **Quyền hạn:** Chỉ `ADMIN` (`STAFF`, `COACH`, `USER` nhận `403`).
- **Request Body:**
  ```json
  {
    "name": "Máy chạy bộ",
    "baseCode": "EQ-TM",
    "quantity": 3,
    "purchaseDate": "2026-06-01",
    "note": "Lô nhập tháng 6"
  }
  ```
  - `name` (bắt buộc): Tên thiết bị, dùng chung cho cả lô (tên này cũng là khóa gom nhóm ở `/equipment/summary` và `/equipment/details?name=`).
  - `baseCode` (bắt buộc): Tiền tố mã máy (ví dụ `EQ-TM`).
  - `quantity` (bắt buộc): Số lượng máy cần tạo, phải lớn hơn `0`. Không có giới hạn tối đa.
  - `purchaseDate` (optional): Ngày mua, định dạng `YYYY-MM-DD`, áp dụng cho cả lô. Bỏ trống thì lưu `null`.
  - `note` (optional): Ghi chú chung cho cả lô. Bỏ trống hoặc chuỗi rỗng thì lưu `null`.
- **Quy tắc sinh mã tự động:**
  - Hệ thống lấy tất cả thiết bị có `code` **bắt đầu bằng** `baseCode` (so khớp tiền tố, phân biệt hoa/thường), tách phần sau dấu `-` cuối cùng của từng mã và parse thành số nguyên; số lớn nhất tìm được là `maxSuffix` (mặc định `0` nếu chưa có mã nào hoặc phần cuối không phải số).
  - Với `i = 1..quantity`, mã mới là `{baseCode}-{maxSuffix + i}` với số thứ tự được đệm `0` thành tối thiểu 2 chữ số (`01`, `02`, ..., `10`, ..., `99`, `100`).
  - Ví dụ: đã có `EQ-TM-01`, `EQ-TM-02`, `EQ-TM-03`, gọi với `quantity = 2` sẽ tạo `EQ-TM-04`, `EQ-TM-05`.
- **Giá trị mặc định của bản ghi mới:** `status = OPERATIONAL`, `lastMaintenanceDate = null`, `location = null`.
- **Thành công `201`:** (không trả `data`)
  ```json
  {
    "success": true,
    "message": "Đã thêm mới 3 thiết bị thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`.
  - `INVALID_QUANTITY` (400): `quantity` nhỏ hơn hoặc bằng `0`.
  - `500`: thiếu `name`, `purchaseDate` không phải ngày hợp lệ, hoặc trùng `code` (unique) khi hai request tạo cùng `baseCode` đồng thời.
- **Lưu ý:** Code chỉ kiểm tra `quantity <= 0`. Nếu bỏ trống `quantity`, request vẫn thành công `201` với thông điệp "Đã thêm mới 0 thiết bị thành công." và không tạo bản ghi nào.

---

## GET `/equipment/summary`

Xem danh sách tổng kết số lượng thiết bị theo nhóm tên (phục vụ hiển thị danh sách dạng thẻ tổng quát).

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (`ADMIN`, `STAFF`, `COACH`, `USER`). Không có kiểm tra role, mọi tài khoản đều xem được toàn bộ thiết bị của phòng tập và response giống nhau cho mọi role.
- **Query Parameters:**
  - `search` (optional): Lọc theo tên thiết bị, khớp chuỗi con (`contains`), không phân biệt hoa/thường.
- **Cách tính:** Gom nhóm theo `name` chính xác. Không phân trang. Thứ tự các nhóm theo thiết bị mới tạo nhất (`createdAt` giảm dần) của từng nhóm.
- **Thành công `200`:**
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
  - `totalCount`: tổng số máy của nhóm.
  - `operationalCount`: số máy có `status = OPERATIONAL`.
  - `brokenCount`: số máy có trạng thái khác `OPERATIONAL` (gồm cả `UNDER_MAINTENANCE` và `OUT_OF_SERVICE`).
  - Không có thiết bị nào khớp thì `data` là mảng rỗng `[]`.
- **Lỗi thường gặp:** `500` (lỗi truy vấn database).

---

## GET `/equipment/details`

Xem danh sách chi tiết từng máy cụ thể trong một nhóm thiết bị hoặc hiển thị toàn bộ sảnh.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập. Mọi tài khoản đều xem được toàn bộ thiết bị của phòng tập, nhưng **trường dữ liệu trả về khác nhau theo role**:
  - `USER` hoặc `COACH`: chỉ trả về các trường cơ bản `id`, `name`, `code`, `status`.
  - `ADMIN` hoặc `STAFF`: trả về toàn bộ các trường của Equipment (`location`, `purchaseDate`, `lastMaintenanceDate`, `note`, `createdAt`, `updatedAt`, ...).
- **Query Parameters:**
  - `name` (optional): Tên nhóm thiết bị, so khớp **chính xác** (phân biệt hoa/thường), ví dụ `Máy chạy bộ`. Bỏ trống thì lấy toàn bộ thiết bị.
  - `status` (optional): Lọc theo `EquipmentStatus`. Giá trị không thuộc enum gây lỗi `500`.
  - `search` (optional): Tìm theo mã thiết bị (`code`), khớp chuỗi con, không phân biệt hoa/thường.
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số bản ghi mỗi trang, mặc định `10`. Không có giới hạn tối đa.
  - Các bộ lọc `name`, `status`, `search` được kết hợp bằng AND. Kết quả sắp xếp theo `code` tăng dần.
  - `page`/`limit` không được validate: giá trị không phải số hoặc âm có thể làm truy vấn lỗi (`500`); `limit=0` trả `data` rỗng và `meta.totalPages` là `null` (do chia cho 0).
- **Thành công `200` (Phản hồi cho ADMIN/STAFF):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Máy chạy bộ",
        "code": "EQ-TM-01",
        "status": "OPERATIONAL",
        "location": null,
        "purchaseDate": "2026-06-01T00:00:00.000Z",
        "lastMaintenanceDate": "2026-06-20T00:00:00.000Z",
        "note": "Lô nhập tháng 6",
        "createdAt": "2026-06-01T00:00:00.000Z",
        "updatedAt": "2026-06-20T00:00:00.000Z"
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
- **Thành công `200` (Phản hồi cho USER/COACH):**
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
- **Lỗi thường gặp:** `500` (tham số `status`/`page`/`limit` không hợp lệ hoặc lỗi database).

---

## PUT `/equipment/bulk-update`

Cập nhật trạng thái/ghi chú/ngày bảo trì cuối hàng loạt cho nhiều thiết bị theo danh sách ID.

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Request Body:**
  ```json
  {
    "ids": [1, 2, 3],
    "status": "UNDER_MAINTENANCE",
    "note": "Bảo trì định kỳ",
    "lastMaintenanceDate": "2026-06-24"
  }
  ```
  - `ids` (bắt buộc): Mảng ID thiết bị, không được rỗng.
  - `status` (optional): `EquipmentStatus`. Chỉ được áp dụng khi có giá trị (truthy).
  - `note` (optional): Ghi chú mới. Áp dụng khi khác `undefined` (truyền `null` sẽ xóa ghi chú).
  - `lastMaintenanceDate` (optional): Ngày bảo trì cuối, định dạng `YYYY-MM-DD`. Chỉ được áp dụng khi có giá trị.
  - Chỉ những trường được truyền mới bị cập nhật; cùng một giá trị được áp dụng cho tất cả các thiết bị trong `ids`.
- **Thành công `200`:** (không trả `data`)
  ```json
  {
    "success": true,
    "message": "Đã cập nhật 3 thiết bị thành công."
  }
  ```
  - Số trong thông điệp là số bản ghi thực sự được cập nhật. ID không tồn tại bị bỏ qua, không báo lỗi.
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `BAD_REQUEST` (400): `ids` thiếu hoặc là mảng rỗng.
  - `500`: `status` không thuộc enum, `lastMaintenanceDate` không hợp lệ, `ids` không phải mảng số.
- **Lưu ý:** API này chỉ đổi dữ liệu thiết bị, không tạo/cập nhật lịch bảo trì (`MaintenanceTask`).

---

## POST `/equipment/bulk-delete`

Xóa hàng loạt thiết bị phòng gym ra khỏi hệ thống theo danh sách ID (xóa cứng).

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Request Body:**
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```
  - `ids` (bắt buộc): Mảng ID thiết bị, không được rỗng.
- **Thành công `200`:** (không trả `data`)
  ```json
  {
    "success": true,
    "message": "Đã xóa 3 thiết bị thành công."
  }
  ```
  - Số trong thông điệp là số bản ghi thực sự bị xóa. ID không tồn tại bị bỏ qua, không báo lỗi.
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `BAD_REQUEST` (400): `ids` thiếu hoặc là mảng rỗng.
- **Side effect:** Lịch bảo trì (`MaintenanceTask`) của các thiết bị bị xóa cũng bị xóa theo (cascade).

---

## PUT `/equipment/:id`

Cập nhật trạng thái, ghi chú hoặc ngày bảo trì cuối cho một thiết bị cụ thể.

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Path Param:** `id` (số nguyên) - ID thiết bị.
- **Request Body:** (tất cả optional, chỉ trường được truyền mới bị cập nhật; cùng quy tắc như `bulk-update`)
  ```json
  {
    "status": "OUT_OF_SERVICE",
    "note": "Hỏng màn hình điều khiển",
    "lastMaintenanceDate": "2026-06-24"
  }
  ```
  - `status`: `EquipmentStatus`, áp dụng khi có giá trị.
  - `note`: áp dụng khi khác `undefined` (truyền `null` để xóa).
  - `lastMaintenanceDate`: `YYYY-MM-DD`, áp dụng khi có giá trị.
  - Không thể đổi `name`, `code`, `purchaseDate`, `location` qua API này.
- **Thành công `200`:** `data` là đối tượng Equipment sau khi cập nhật.
  ```json
  {
    "success": true,
    "message": "Cập nhật thiết bị thành công.",
    "data": {
      "id": 1,
      "name": "Máy chạy bộ",
      "code": "EQ-TM-01",
      "status": "OUT_OF_SERVICE",
      "location": null,
      "purchaseDate": "2026-06-01T00:00:00.000Z",
      "lastMaintenanceDate": "2026-06-24T00:00:00.000Z",
      "note": "Hỏng màn hình điều khiển",
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-24T03:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): `id` không phải số.
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `EQUIPMENT_NOT_FOUND` (404): Không có thiết bị với `id` này.
  - `500`: `status` không thuộc enum hoặc `lastMaintenanceDate` không hợp lệ.

---

## DELETE `/equipment/:id`

Xóa một thiết bị cụ thể ra khỏi hệ thống (xóa cứng).

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Path Param:** `id` (số nguyên) - ID thiết bị.
- **Thành công `200`:** (không trả `data`)
  ```json
  {
    "success": true,
    "message": "Xóa thiết bị thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): `id` không phải số.
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `EQUIPMENT_NOT_FOUND` (404): Không có thiết bị với `id` này.
- **Side effect:** Lịch bảo trì của thiết bị bị xóa theo (cascade).

---

## GET `/equipment/stats`

Lấy tổng hợp số lượng máy móc theo từng trạng thái (tổng số máy, đang chạy tốt, đang bảo trì, đã hỏng).

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "data": {
      "total": 50,
      "operational": 45,
      "underMaintenance": 3,
      "outOfService": 2
    }
  }
  ```
  - `total`: tổng số thiết bị (cộng dồn từ 3 trạng thái). Trạng thái không có máy nào được trả `0`.
- **Lỗi thường gặp:** `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.

---

## GET `/equipment/maintenance/tasks`

Lấy danh sách các lịch bảo trì thiết bị phòng tập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập. Code chỉ kiểm tra token có role, không hạn chế theo role (kể cả `USER`/`COACH` đều gọi được và nhận cùng dữ liệu).
- **Query Parameters:**
  - `month` (optional): Tháng cần lọc (`1` - `12`), phải đi kèm `year`.
  - `year` (optional): Năm cần lọc, phải đi kèm `month`.
  - Cả hai được parse bằng `parseInt`. Chỉ khi **cả hai** có giá trị hợp lệ (khác `0`/`NaN`) thì mới lọc theo tháng; nếu thiếu một trong hai, hoặc không phải số thì bị bỏ qua và áp dụng chế độ mặc định. `month` ngoài khoảng `1-12` không bị báo lỗi (theo quy tắc cộng dồn ngày của JavaScript `Date`).
- **Hai chế độ lọc:**
  - Có `month` + `year`: trả các lịch có `scheduledAt` nằm trong tháng đó (từ ngày 1 đến hết ngày cuối tháng, theo múi giờ của server), **mọi trạng thái** (kể cả `COMPLETED`, `CANCELLED`).
  - Không có `month` + `year`: trả các lịch chưa hoàn thành (`status` là `PENDING` hoặc `IN_PROGRESS`), không giới hạn ngày (gồm cả lịch đã quá hạn).
- **Sắp xếp:** `scheduledAt` tăng dần. Không phân trang.
- **Thành công `200`:** `data` là mảng MaintenanceTask, mỗi phần tử kèm thông tin thiết bị rút gọn `equipment: { name, code }`.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "equipmentId": 1,
        "title": "Bảo dưỡng xích tạ máy kéo lưng sảnh A",
        "description": "Cân chỉnh dây cáp và bôi dầu bôi trơn chuyên dụng",
        "scheduledAt": "2026-06-25T00:00:00.000Z",
        "completedAt": null,
        "priority": "NORMAL",
        "status": "PENDING",
        "assignedTeam": "Đội Kỹ thuật sảnh A",
        "cost": null,
        "notes": null,
        "createdAt": "2026-06-24T00:00:00.000Z",
        "updatedAt": "2026-06-24T00:00:00.000Z",
        "equipment": {
          "name": "Máy kéo lưng",
          "code": "EQ-BK-01"
        }
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `500` (lỗi truy vấn database).

---

## POST `/equipment/maintenance/tasks`

Lên lịch bảo trì mới cho một hoặc nhiều thiết bị. Hệ thống tạo **một bản ghi lịch bảo trì cho mỗi thiết bị** trong `equipmentIds` và **tự động** chuyển trạng thái của tất cả các thiết bị này sang `UNDER_MAINTENANCE`.

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Request Body:**
  ```json
  {
    "equipmentIds": [1, 2],
    "title": "Bảo dưỡng xích tạ máy kéo lưng sảnh A",
    "description": "Cân chỉnh dây cáp và bôi dầu bôi trơn chuyên dụng",
    "scheduledAt": "2026-06-25",
    "priority": "NORMAL",
    "assignedTeam": "Đội Kỹ thuật sảnh A"
  }
  ```
  - `equipmentIds` (bắt buộc): Mảng ID thiết bị, không được rỗng.
  - `title` (bắt buộc): Tiêu đề đầu việc (tối đa 255 ký tự theo database).
  - `description` (optional): Mô tả chi tiết. Bỏ trống thì lưu `null`.
  - `scheduledAt` (bắt buộc): Ngày lên lịch, định dạng `YYYY-MM-DD`.
  - `priority` (theo DTO là bắt buộc): `CRITICAL` (Khẩn cấp), `ROUTINE` (Định kỳ) hoặc `NORMAL` (Bình thường). Nếu bỏ trống, database dùng mặc định `NORMAL`; giá trị khác gây lỗi `500`.
  - `assignedTeam` (optional): Đội kỹ thuật phụ trách. Bỏ trống thì lưu `null`.
- **Hành vi tự động:**
  - Mỗi lịch được tạo với `status = PENDING`.
  - Sau khi tạo, tất cả thiết bị trong `equipmentIds` được đặt `status = UNDER_MAINTENANCE` (kể cả khi đang `OUT_OF_SERVICE`). `lastMaintenanceDate` không bị đổi ở bước này.
  - Việc tạo lịch và cập nhật trạng thái thiết bị **không nằm trong một transaction**.
- **Thành công `201`:** `data` là mảng các bản ghi MaintenanceTask vừa tạo (không kèm `equipment`).
  ```json
  {
    "success": true,
    "message": "Đã lên lịch bảo trì thiết bị.",
    "data": [
      {
        "id": 1,
        "equipmentId": 1,
        "title": "Bảo dưỡng xích tạ máy kéo lưng sảnh A",
        "description": "Cân chỉnh dây cáp và bôi dầu bôi trơn chuyên dụng",
        "scheduledAt": "2026-06-25T00:00:00.000Z",
        "completedAt": null,
        "priority": "NORMAL",
        "status": "PENDING",
        "assignedTeam": "Đội Kỹ thuật sảnh A",
        "cost": null,
        "notes": null,
        "createdAt": "2026-06-24T00:00:00.000Z",
        "updatedAt": "2026-06-24T00:00:00.000Z"
      },
      {
        "id": 2,
        "equipmentId": 2,
        "title": "Bảo dưỡng xích tạ máy kéo lưng sảnh A",
        "description": "Cân chỉnh dây cáp và bôi dầu bôi trơn chuyên dụng",
        "scheduledAt": "2026-06-25T00:00:00.000Z",
        "completedAt": null,
        "priority": "NORMAL",
        "status": "PENDING",
        "assignedTeam": "Đội Kỹ thuật sảnh A",
        "cost": null,
        "notes": null,
        "createdAt": "2026-06-24T00:00:00.000Z",
        "updatedAt": "2026-06-24T00:00:00.000Z"
      }
    ]
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `BAD_REQUEST` (400): `equipmentIds` thiếu hoặc là mảng rỗng.
  - `500`: thiếu `title`, `scheduledAt` không hợp lệ, `priority` sai enum, hoặc có `equipmentId` không tồn tại (vi phạm khóa ngoại). Vì các lịch được tạo song song và không có transaction, các lịch của thiết bị hợp lệ có thể đã được tạo trước khi lỗi xảy ra, và khi đó bước chuyển trạng thái sang `UNDER_MAINTENANCE` không được chạy.
  - Không kiểm tra trùng lặp: `equipmentIds` chứa ID lặp sẽ tạo nhiều lịch cho cùng thiết bị.

---

## PUT `/equipment/maintenance/tasks/:id`

Cập nhật trạng thái, chi phí hoặc ghi chú cho một lịch bảo trì (ví dụ chuyển trạng thái sang `COMPLETED`).

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Path Param:** `id` (số nguyên) - ID lịch bảo trì (`MaintenanceTask`).
- **Request Body:** (tất cả optional)
  ```json
  {
    "status": "COMPLETED",
    "cost": 150000,
    "notes": "Đã thay cáp mới chạy êm."
  }
  ```
  - `status`: một trong `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`. Áp dụng khi có giá trị; giá trị sai enum gây lỗi `500`.
  - `cost`: Chi phí (số). Áp dụng khi khác `undefined`.
  - `notes`: Ghi chú. Áp dụng khi khác `undefined`.
  - Không thể đổi `title`, `description`, `scheduledAt`, `priority`, `assignedTeam`, `equipmentId` qua API này.
- **Hành vi tự động đặc biệt khi `status` gửi lên là `COMPLETED`:**
  - Lịch bảo trì được gán `completedAt` bằng thời gian hiện tại.
  - Thiết bị của lịch (`equipmentId`) được chuyển về `status = OPERATIONAL` và `lastMaintenanceDate` = thời gian hiện tại.
  - Hai bước cập nhật (lịch và thiết bị) không nằm trong một transaction. Gửi lại `COMPLETED` cho lịch đã hoàn thành sẽ ghi đè `completedAt` và đặt lại thiết bị về `OPERATIONAL` một lần nữa.
- **Với các trạng thái khác** (`PENDING`, `IN_PROGRESS`, `CANCELLED`): chỉ cập nhật bản ghi lịch bảo trì, **không** thay đổi trạng thái thiết bị (ví dụ hủy lịch không tự đưa máy về `OPERATIONAL`).
- **Thành công `200`:** `data` là bản ghi MaintenanceTask sau cập nhật (không kèm `equipment`).
  ```json
  {
    "success": true,
    "message": "Cập nhật lịch bảo trì thành công.",
    "data": {
      "id": 1,
      "equipmentId": 1,
      "title": "Bảo dưỡng xích tạ máy kéo lưng sảnh A",
      "description": "Cân chỉnh dây cáp và bôi dầu bôi trơn chuyên dụng",
      "scheduledAt": "2026-06-25T00:00:00.000Z",
      "completedAt": "2026-06-25T08:30:00.000Z",
      "priority": "NORMAL",
      "status": "COMPLETED",
      "assignedTeam": "Đội Kỹ thuật sảnh A",
      "cost": "150000",
      "notes": "Đã thay cáp mới chạy êm.",
      "createdAt": "2026-06-24T00:00:00.000Z",
      "updatedAt": "2026-06-25T08:30:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): `id` không phải số.
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `MAINTENANCE_TASK_NOT_FOUND` (404): Không có lịch bảo trì với `id` này.
  - `500`: `status` sai enum hoặc `cost` sai kiểu.
