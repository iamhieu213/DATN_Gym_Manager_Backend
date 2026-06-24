# Equipment API

Base path: `/equipment`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Enum `EquipmentStatus`

- `OPERATIONAL`: Hoạt động tốt
- `UNDER_MAINTENANCE`: Đang bảo trì
- `OUT_OF_SERVICE`: Hỏng / Ngừng hoạt động

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
  "branchId": 1,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

---

## POST `/equipment`

Tạo mới hàng loạt thiết bị phòng gym, mã thiết bị tự động được sinh tăng dần dựa trên `baseCode`.

- **Quyền hạn:** Chỉ `ADMIN`.
- **Request Body:**
  ```json
  {
    "name": "Máy chạy bộ",
    "baseCode": "EQ-TM",
    "quantity": 3,
    "purchaseDate": "2026-06-01",
    "note": "Lô nhập tháng 6",
    "branchId": 1
  }
  ```
  - **Lưu ý:** `branchId` là **bắt buộc** để xác định chi nhánh đặt thiết bị.
- **Thành công `201`:**
  ```json
  {
    "success": true,
    "message": "Đã thêm mới 3 thiết bị thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): Không truyền `branchId`.
  - `INVALID_QUANTITY` (400): Số lượng `quantity` nhỏ hơn hoặc bằng 0.
  - `FORBIDDEN` (403): Không phải ADMIN.

---

## GET `/equipment/summary`

Xem danh sách tổng kết số lượng thiết bị theo nhóm tên (phục vụ hiển thị danh sách dạng thẻ tổng quát).

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF`: Tự động giới hạn xem thiết bị tại **chi nhánh của STAFF đó**.
    - Tài khoản `ADMIN`: Mặc định xem toàn bộ hoặc lọc theo `branchId` gửi kèm trong query.
- **Query Parameters:**
  - `search` (optional): Lọc tìm kiếm theo tên thiết bị.
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN có quyền dùng để lọc chi nhánh khác).
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
  - **Lưu ý:** `brokenCount` được tính bằng tổng số thiết bị có trạng thái khác `OPERATIONAL` (gồm cả `UNDER_MAINTENANCE` và `OUT_OF_SERVICE`).

---

## GET `/equipment/details`

Xem danh sách chi tiết từng máy cụ thể trong một nhóm thiết bị hoặc hiển thị toàn bộ sảnh.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF`: Tự động giới hạn thiết bị của **chi nhánh của STAFF đó**.
    - Tài khoản `ADMIN`: Xem toàn hệ thống hoặc lọc theo `branchId` trong query.
  - **Cơ chế ẩn thông tin nhạy cảm:**
    - Nếu là `USER` hoặc `COACH`: Hệ thống chỉ trả về các trường cơ bản: `id`, `name`, `code`, `status`.
    - Nếu là `ADMIN` hoặc `STAFF`: Trả về toàn bộ các trường thông tin (ngày mua, lịch sử bảo trì, ghi chú...).
- **Query Parameters:**
  - `name` (optional): Tên của nhóm thiết bị (ví dụ: `"Máy chạy bộ"`). Nếu bỏ trống sẽ tải toàn bộ thiết bị.
  - `page` (optional): Trang hiện tại, mặc định `1`.
  - `limit` (optional): Số lượng bản ghi/trang, mặc định `10`.
  - `status` (optional): Lọc theo `EquipmentStatus`.
  - `search` (optional): Tìm kiếm theo mã thiết bị (`code`).
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN có quyền lọc chi nhánh khác).

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
        "purchaseDate": "2026-06-01T00:00:00.000Z",
        "lastMaintenanceDate": "2026-06-20T00:00:00.000Z",
        "note": "Lô nhập tháng 6",
        "branchId": 1
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

---

## PUT `/equipment/bulk-update`

Cập nhật thông tin/trạng thái hàng loạt cho nhiều thiết bị theo danh sách ID.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Phân quyền chi nhánh:** Tài khoản `STAFF` chỉ có thể cập nhật các thiết bị thuộc **chi nhánh của mình**. Nếu danh sách gửi lên chứa bất kỳ thiết bị nào của chi nhánh khác, hệ thống sẽ trả lỗi `FORBIDDEN` (403).
- **Request Body:**
  ```json
  {
    "ids": [1, 2, 3],
    "status": "UNDER_MAINTENANCE",
    "note": "Bảo trì định kỳ",
    "lastMaintenanceDate": "2026-06-24"
  }
  ```
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Đã cập nhật 3 thiết bị thành công."
  }
  ```

---

## POST `/equipment/bulk-delete`

Xóa hàng loạt thiết bị phòng gym ra khỏi hệ thống theo danh sách ID.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ được xóa thiết bị tại chi nhánh của mình).
- **Request Body:**
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Đã xóa 3 thiết bị thành công."
  }
  ```

---

## PUT `/equipment/:id`

Cập nhật trạng thái hoặc ghi chú cho một thiết bị cụ thể.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ được cập nhật thiết bị tại chi nhánh của mình).
- **Request Body:**
  ```json
  {
    "status": "OUT_OF_SERVICE",
    "note": "Hỏng màn hình điều khiển",
    "lastMaintenanceDate": "2026-06-24"
  }
  ```
- **Thành công `200`:** Trả về đối tượng thiết bị sau khi cập nhật.

---

## DELETE `/equipment/:id`

Xóa một thiết bị cụ thể ra khỏi hệ thống.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ được xóa thiết bị tại chi nhánh của mình).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Xóa thiết bị thành công."
  }
  ```

---

## GET `/equipment/stats`

Lấy tổng hợp số lượng máy móc theo từng trạng thái (tổng số máy, đang chạy tốt, đang bảo trì, đã hỏng).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - STAFF chỉ xem thống kê của chi nhánh mình. ADMIN xem toàn bộ hoặc lọc theo `branchId` trong query.
- **Query Parameters:**
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN).
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

---

## GET `/equipment/maintenance/tasks`

Lấy danh sách các lịch bảo trì thiết bị phòng tập.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ xem lịch thuộc chi nhánh của mình).
- **Query Parameters:**
  - `month` (optional): Tháng cần lọc (1 - 12), yêu cầu phải đi kèm `year`.
  - `year` (optional): Năm cần lọc, yêu cầu đi kèm `month`.
  - `branchId` (optional): Lọc theo ID chi nhánh (chỉ ADMIN).
- **Lưu ý:** Nếu không truyền `month` và `year`, hệ thống sẽ trả về danh sách các lịch bảo trì chưa hoàn thành (`PENDING` hoặc `IN_PROGRESS`).
- **Thành công `200`:** `data` là mảng danh sách lịch bảo trì.

---

## POST `/equipment/maintenance/tasks`

Lên lịch bảo trì mới cho một hoặc nhiều thiết bị. Hệ thống sẽ **tự động** cập nhật trạng thái của tất cả các thiết bị này sang `UNDER_MAINTENANCE`.

- **Quyền hạn:** `ADMIN`, `STAFF`. (STAFF chỉ được lên lịch cho thiết bị thuộc chi nhánh mình).
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
  - **Độ ưu tiên (`priority`):** Nhận một trong các giá trị: `CRITICAL` (Khẩn cấp), `ROUTINE` (Định kỳ), `NORMAL` (Bình thường).
- **Thành công `201`:** Trả về danh sách các bản ghi lịch bảo trì đã được tạo.

---

## PUT `/equipment/maintenance/tasks/:id`

Cập nhật thông tin hoặc trạng thái cho một lịch bảo trì (ví dụ chuyển trạng thái sang `COMPLETED`).
- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Hành vi tự động đặc biệt:** Nếu trạng thái cập nhật gửi lên là **`COMPLETED`** (Đã hoàn thành bảo trì):
  - Hệ thống sẽ tự động gán ngày hoàn thành `completedAt` bằng thời gian hiện tại.
  - Hệ thống sẽ tự động tìm thiết bị tương ứng và chuyển trạng thái máy về **`OPERATIONAL`** (Hoạt động tốt), đồng thời cập nhật trường ngày bảo trì cuối `lastMaintenanceDate` bằng thời gian hiện tại.
- **Request Body:**
  ```json
  {
    "status": "COMPLETED",
    "cost": 150000,
    "notes": "Đã thay cáp mới chạy êm."
  }
  ```
- **Thành công `200`:** Trả về bản ghi lịch bảo trì sau cập nhật.
