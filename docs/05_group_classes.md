# Module 5: Group Classes & Bookings (Lớp học nhóm & Đặt chỗ)

Module này quản lý việc tạo các lớp học nhóm tập trung (Yoga, Zumba, Boxing, Cardio...) do Huấn luyện viên đứng lớp và quản lý việc hội viên đăng ký giữ chỗ tham gia.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `group_classes`**: Lưu lịch học của các lớp tập trung (tên lớp, PT đứng lớp, sức chứa tối đa, giờ học, thời lượng, trạng thái...).
*   **Bảng `class_bookings`**: Ghi nhận danh sách hội viên đăng ký giữ chỗ tham gia lớp học nhóm (`user_id` đặt chỗ lớp `class_id` kèm trạng thái xác nhận tham gia hay vắng mặt).

---

## 2. Các chức năng chính (Core Features)
*   Admin/Staff lên lịch cho các lớp học nhóm trong tuần (gán PT dạy, phòng học, giờ bắt đầu, số lượng ghế tối đa).
*   Hội viên xem lịch học các lớp trong tuần (được phân loại theo ngày).
*   Hội viên thực hiện đặt chỗ (`Book Class`) trước giờ học. Hệ thống tự động kiểm tra sức chứa tối đa và trừ suất trống.
*   Hội viên hủy đặt chỗ nếu bận không tham gia được (chỉ cho phép hủy trước giờ học tối thiểu 1 tiếng).
*   Huấn luyện viên đứng lớp hoặc Staff điểm danh hội viên tham dự lớp học (`ATTENDED` hoặc `NO_SHOW` - vắng không lý do).

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Lớp học nhóm (Group Classes APIs)

#### 1. Lấy lịch học các lớp nhóm (Dành cho hội viên & HLV)
*   **Endpoint:** `GET /api/classes`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `date` (lọc theo ngày cụ thể, ví dụ `2026-05-23`), `status` (mặc định là `SCHEDULED` hoặc `ONGOING`).
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy danh sách lớp học thành công.",
      "data": [
        {
          "id": "uuid-class-1",
          "name": "Lớp Yoga Căn Bản",
          "description": "Các tư thế cơ bản giúp dẻo dai cơ thể.",
          "coachName": "Trần Văn B (PT)",
          "maxCapacity": 20,
          "currentEnrolled": 12,
          "scheduledAt": "2026-05-23T18:00:00.000Z",
          "durationMinutes": 60,
          "status": "SCHEDULED"
        }
      ]
    }
    ```

#### 2. Lên lịch lớp học mới (Admin/Staff)
*   **Endpoint:** `POST /api/classes`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "coachId": "uuid-coach-user-id",
      "name": "Lớp Zumba Sôi Động",
      "description": "Nhảy tự do trên nền nhạc Latinh để tiêu hao năng lượng.",
      "maxCapacity": 25,
      "scheduledAt": "2026-05-24T19:30:00.000Z",
      "durationMinutes": 45
    }
    ```

#### 3. Cập nhật thông tin/Hủy lịch lớp học (Admin/Staff)
*   **Endpoint:** `PATCH /api/classes/:id`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Mô tả:** Thay đổi giờ dạy, PT dạy hoặc hủy lớp (cập nhật trạng thái thành `CANCELLED`).

---

### 3.2. API Đặt chỗ lớp học (Class Bookings APIs)

#### 1. Hội viên đăng ký đặt chỗ lớp học nhóm
*   **Endpoint:** `POST /api/class-bookings`
*   **Quyền truy cập:** Đăng nhập (Role USER)
*   **Mô tả:** Đăng ký tham gia lớp học. Hệ thống kiểm tra xem lớp đã đầy chưa, hội viên có bị trùng lịch lớp khác không.
*   **Request Body (JSON):**
    ```json
    {
      "classId": "uuid-class-1"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Đăng ký tham gia lớp học thành công.",
      "data": {
        "bookingId": "uuid-booking-id",
        "classId": "uuid-class-1",
        "status": "CONFIRMED",
        "bookedAt": "2026-05-23T10:00:00.000Z"
      }
    }
    ```

#### 2. Hội viên hủy đặt chỗ
*   **Endpoint:** `PATCH /api/class-bookings/:bookingId/cancel`
*   **Quyền truy cập:** Đăng nhập (Role USER)
*   **Mô tả:** Thay đổi trạng thái đặt chỗ thành `CANCELLED`. Giải phóng 1 suất trống cho lớp học đó.

#### 3. Điểm danh hội viên tham gia lớp (Dành cho PT đứng lớp/Staff)
*   **Endpoint:** `PATCH /api/class-bookings/:bookingId/attendance`
*   **Quyền truy cập:** ADMIN, STAFF, COACH (chỉ HLV được phân công dạy lớp đó)
*   **Request Body (JSON):**
    ```json
    {
      "status": "ATTENDED" // Hoặc "NO_SHOW" (vắng không phép)
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Điểm danh thành viên thành công.",
      "data": {
        "bookingId": "uuid-booking-id",
        "status": "ATTENDED"
      }
    }
    ```

#### 4. Xem danh sách hội viên đã đăng ký trong một lớp học
*   **Endpoint:** `GET /api/classes/:classId/bookings`
*   **Quyền truy cập:** ADMIN, STAFF, COACH (đứng lớp)
*   **Response (JSON):** Danh sách toàn bộ học viên đã đăng ký kèm thông tin trạng thái điểm danh để phục vụ việc dạy học.
