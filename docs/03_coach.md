# Module 3: Coach & PT Assignment (Quản lý Huấn luyện viên & Phân công)

Module này quản lý thông tin lý lịch cá nhân chuyên sâu của các Huấn luyện viên cá nhân (PT/Coach) và việc gán HLV kèm cặp cho các hội viên.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `coach_profiles`**: Lưu trữ thông tin chuyên môn, bio giới thiệu, giá thuê theo giờ, xếp hạng đánh giá và trạng thái làm việc của HLV (liên kết 1-1 với bảng `users` có `role = COACH`).
*   **Bảng `coach_assignments`**: Ghi nhận lịch sử huấn luyện của HLV với hội viên (`coach_id` kèm cặp cho `user_id` từ ngày nào đến ngày nào).

---

## 2. Các chức năng chính (Core Features)
*   HLV tự cập nhật hồ sơ chuyên môn (Kinh nghiệm, Bio giới thiệu, Chuyên môn tập luyện như giảm cân, tăng cơ, yoga, v.v.).
*   Hội viên xem danh sách các HLV đang làm việc tại phòng tập kèm theo đánh giá (`rating`), giá thuê (`hourly_rate`) và chuyên môn (`speciality`).
*   Admin/Staff cập nhật thông tin mức giá, trạng thái sẵn sàng nhận khách (`is_available`) của HLV.
*   Admin/Staff phân công HLV hỗ trợ cho hội viên sau khi hội viên mua gói tập kèm PT (hoặc hội viên tự chọn PT khi đăng ký gói).
*   Xem lịch sử huấn luyện (dành cho cả HLV và hội viên).

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Hồ sơ Huấn luyện viên (Coach Profile APIs)

#### 1. Lấy danh sách hồ sơ Huấn luyện viên (Dành cho hội viên tìm PT)
*   **Endpoint:** `GET /api/coaches`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `speciality` (lọc theo chuyên môn), `isAvailable` (lọc PT đang rảnh), `search` (tìm theo tên PT).
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy danh sách huấn luyện viên thành công.",
      "data": [
        {
          "id": "uuid-coach-profile-1",
          "userId": "uuid-user-coach-1",
          "name": "Trần Văn B",
          "avatarUrl": "https://res.cloudinary.com/...",
          "speciality": "Tăng cơ - Giảm mỡ",
          "bio": "5 năm kinh nghiệm thi đấu thể hình thế giới.",
          "hourlyRate": 300000.00,
          "rating": 4.8,
          "totalReviews": 25,
          "isAvailable": true
        }
      ]
    }
    ```

#### 2. Xem chi tiết hồ sơ một Huấn luyện viên
*   **Endpoint:** `GET /api/coaches/:userId`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Mô tả:** Xem đầy đủ thông tin cá nhân và lý lịch chuyên môn của PT dựa trên `userId`.

#### 3. Huấn luyện viên tự cập nhật hồ sơ của mình
*   **Endpoint:** `PUT /api/coaches/me`
*   **Quyền truy cập:** HLV (COACH)
*   **Request Body (JSON):**
    ```json
    {
      "speciality": "Calisthenics & Powerlifting",
      "bio": "Chuyên đào tạo các bài tập sử dụng trọng lượng cơ thể và tạ nặng.",
      "hourlyRate": 250000.00
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Cập nhật hồ sơ huấn luyện viên thành công.",
      "data": { ... }
    }
    ```

#### 4. Quản trị viên cập nhật trạng thái làm việc của HLV
*   **Endpoint:** `PATCH /api/coaches/:userId/status`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "isAvailable": false,
      "hourlyRate": 350000.00
    }
    ```

---

### 3.2. API Phân công Huấn luyện (Coach Assignments APIs)

#### 1. Admin/Staff phân công PT cho hội viên
*   **Endpoint:** `POST /api/coach-assignments`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "coachId": "uuid-user-coach-id",
      "userId": "uuid-user-member-id",
      "startDate": "2026-05-25",
      "endDate": "2026-08-25"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Phân công huấn luyện viên thành công.",
      "data": {
        "id": "uuid-assignment-id",
        "coachId": "uuid-user-coach-id",
        "userId": "uuid-user-member-id",
        "startDate": "2026-05-25"
      }
    }
    ```

#### 2. Hội viên xem thông tin PT đang kèm cặp mình
*   **Endpoint:** `GET /api/coach-assignments/my-coach`
*   **Quyền truy cập:** Đăng nhập (Role USER)
*   **Response (JSON):** Trả về chi tiết lý lịch của Coach đang được chỉ định cho người dùng hiện tại và thời hạn kèm cặp.

#### 3. Huấn luyện viên xem danh sách hội viên đang kèm cặp
*   **Endpoint:** `GET /api/coach-assignments/my-trainees`
*   **Quyền truy cập:** HLV (COACH)
*   **Response (JSON):** Trả về danh sách thông tin cơ bản và chỉ số sức khỏe của các hội viên mà PT này đang chịu trách nhiệm hướng dẫn.
