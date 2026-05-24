# Module 9: Equipment Management (Quản lý Thiết bị & Máy tập)

Module này quản lý danh sách trang thiết bị, máy móc tập luyện của phòng tập Gym, phục vụ việc kiểm kê tài sản và lập lịch bảo trì định kỳ.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `equipment`**: Lưu thông tin thiết bị (`name`, `category` như cardio/tạ/phụ kiện, `status` như tốt/hỏng/đang sửa, ngày mua, ngày bảo trì gần nhất và ghi chú).

---

## 2. Các chức năng chính (Core Features)
*   Quản trị viên/Nhân viên kiểm kê thêm mới các máy tập, dụng cụ tạ vào danh sách tài sản phòng tập.
*   Nhân viên cập nhật trạng thái hoạt động của thiết bị (Ví dụ: Chuyển trạng thái máy chạy bộ số 3 sang "Đang hỏng - Đang sửa chữa").
*   Lập lịch và cập nhật thông tin bảo trì định kỳ của máy móc để đảm bảo an toàn cho hội viên khi tập luyện.
*   Xem danh sách các máy móc đang bị hỏng cần sửa gấp.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Thiết bị (Equipment APIs)

#### 1. Lấy danh sách thiết bị phòng tập
*   **Endpoint:** `GET /api/equipment`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Query Params:** `page`, `limit`, `category`, `status` (`GOOD`, `BROKEN`, `MAINTENANCE`), `search` (tìm theo tên máy).
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy danh sách thiết bị thành công.",
      "data": [
        {
          "id": "uuid-equipment-1",
          "name": "Máy chạy bộ Impulse RT700",
          "category": "Cardio",
          "status": "GOOD",
          "purchaseDate": "2025-01-10",
          "lastMaintenance": "2026-04-10",
          "note": "Hoạt động bình thường"
        }
      ],
      "meta": {
        "page": 1,
        "limit": 10,
        "total": 55,
        "totalPages": 6
      }
    }
    ```

#### 2. Thêm mới thiết bị vào phòng tập
*   **Endpoint:** `POST /api/equipment`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "name": "Giàn tạ đa năng Robot",
      "category": "Tạ nặng",
      "status": "GOOD",
      "purchaseDate": "2026-05-20",
      "note": "Mới mua, lắp đặt tại tầng 1"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Thêm mới thiết bị thành công.",
      "data": { ... }
    }
    ```

#### 3. Cập nhật thông tin/Trạng thái của thiết bị
*   **Endpoint:** `PATCH /api/equipment/:id`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Mô tả:** Thay đổi trạng thái sang "HỎNG" hoặc ghi chú tình trạng máy.
*   **Request Body (JSON):**
    ```json
    {
      "status": "MAINTENANCE",
      "note": "Bị đứt cáp kéo ròng rọc, đang chờ thợ sửa chữa."
    }
    ```

#### 4. Ghi nhận thông tin bảo trì máy tập
*   **Endpoint:** `POST /api/equipment/:id/maintenance`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Mô tả:** Ghi nhận ngày vừa bảo trì máy xong, cập nhật trạng thái hoạt động về mức tốt (`GOOD`).
*   **Request Body (JSON):**
    ```json
    {
      "maintenanceDate": "2026-05-23",
      "status": "GOOD",
      "note": "Đã thay cáp mới, tra dầu mỡ xích ròng rọc."
    }
    ```

#### 5. Xóa thiết bị khỏi danh sách (Thanh lý máy cũ)
*   **Endpoint:** `DELETE /api/equipment/:id`
*   **Quyền truy cập:** ADMIN, STAFF
