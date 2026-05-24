# Module 6: Workout Plans & Exercise Logs (Kế hoạch tập luyện & Nhật ký)

Module này quản lý việc thiết kế giáo án tập luyện (Workout Plans), lên lịch tập các buổi (Sessions) và theo dõi nhật ký thực tế của từng hiệp bài tập (Exercise Logs).

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `workout_plans`**: Lưu thông tin cốt lõi của giáo án (Mục tiêu, Độ khó, Số tuần dự kiến, HLV biên soạn hoặc do AI tạo).
*   **Bảng `workout_sessions`**: Lịch trình tập luyện từng ngày của hội viên và trạng thái hoàn thành (`PLANNED`, `COMPLETED`, `SKIPPED`).
*   **Bảng `exercise_logs`**: Nhật ký cụ thể của từng bài tập trong buổi (Tên bài, Số hiệp - sets, Số lần/hiệp - reps, Mức tạ - kg, Thời gian nghỉ).

---

## 2. Các chức năng chính (Core Features)
*   Huấn luyện viên (PT) thiết kế giáo án tập luyện cá nhân hóa cho hội viên kèm cặp.
*   Tích hợp AI tạo nhanh giáo án tập luyện dựa trên mục tiêu (Giảm cân, Tăng cơ, Tăng thể lực) và thể trạng.
*   Hội viên xem giáo án tập luyện được chỉ định, theo dõi danh sách các buổi tập cần hoàn thành theo lịch trình.
*   Hội viên ghi nhật ký tập luyện thực tế sau mỗi buổi tập (ghi lại thông số tạ, hiệp, lần đẩy để đo lường tiến độ).
*   Hệ thống thống kê biểu đồ khối lượng tập luyện để PT và hội viên theo dõi sự phát triển cơ bắp/thể lực.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Giáo án tập luyện (Workout Plans APIs)

#### 1. Tạo giáo án tập luyện (PT tạo cho học viên hoặc AI tạo)
*   **Endpoint:** `POST /api/workouts/plans`
*   **Quyền truy cập:** COACH, ADMIN, hoặc USER (nếu dùng tính năng tự tạo bằng AI)
*   **Request Body (JSON):**
    ```json
    {
      "userId": "uuid-member-id",
      "title": "Giáo án Tăng Cơ Ngực & Vai 4 Tuần",
      "goal": "Tăng cơ, tăng sức mạnh thân trên",
      "durationWeeks": 4,
      "difficulty": "INTERMEDIATE",
      "aiGenerated": false,
      "content": {
        "schedule": [
          { "day": 1, "focus": "Ngực & Tay sau" },
          { "day": 3, "focus": "Lưng & Tay trước" }
        ]
      }
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Tạo giáo án tập luyện thành công.",
      "data": {
        "id": "uuid-plan-id",
        "title": "Giáo án Tăng Cơ Ngực & Vai 4 Tuần",
        "isActive": true
      }
    }
    ```

#### 2. Lấy giáo án tập luyện đang hoạt động của bản thân
*   **Endpoint:** `GET /api/workouts/plans/active`
*   **Quyền truy cập:** Đăng nhập (Role USER)

#### 3. PT lấy danh sách giáo án đã tạo cho học viên
*   **Endpoint:** `GET /api/workouts/plans`
*   **Quyền truy cập:** COACH, ADMIN
*   **Query Params:** `userId` (lọc theo học viên)

---

### 3.2. API Buổi tập & Nhật ký bài tập (Sessions & Logs APIs)

#### 1. Lấy danh sách các buổi tập trong tuần/tháng
*   **Endpoint:** `GET /api/workouts/sessions`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `startDate`, `endDate`, `userId`
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy lịch sử buổi tập thành công.",
      "data": [
        {
          "id": "uuid-session-1",
          "sessionDate": "2026-05-23",
          "status": "PLANNED",
          "note": "Buổi tập ngực tập trung tạ nặng",
          "workoutPlanTitle": "Giáo án Tăng Cơ Ngực & Vai 4 Tuần"
        }
      ]
    }
    ```

#### 2. Cập nhật trạng thái buổi tập (Hoàn thành / Bỏ qua)
*   **Endpoint:** `PATCH /api/workouts/sessions/:id`
*   **Quyền truy cập:** Đăng nhập (USER, COACH)
*   **Request Body (JSON):**
    ```json
    {
      "status": "COMPLETED",
      "durationMinutes": 60,
      "caloriesBurned": 450,
      "note": "Hoàn thành tốt các bài tạ đơn, hơi mỏi cơ vai."
    }
    ```

#### 3. Ghi nhật ký chi tiết hiệp tập (Exercise Logs)
*   **Endpoint:** `POST /api/workouts/sessions/:sessionId/logs`
*   **Quyền truy cập:** Đăng nhập (USER, COACH)
*   **Mô tả:** Lưu thông số thực tế của một bài tập trong buổi tập hiện tại.
*   **Request Body (JSON):**
    ```json
    {
      "exerciseName": "Bench Press (Đẩy ngực tạ đòn)",
      "sets": 4,
      "reps": 10,
      "weightKg": 60,
      "restSeconds": 90,
      "note": "Hiệp cuối cần PT hỗ trợ 2 reps."
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Ghi nhật ký bài tập thành công.",
      "data": { ... }
    }
    ```

#### 4. Xem nhật ký chi tiết của một buổi tập đã qua
*   **Endpoint:** `GET /api/workouts/sessions/:sessionId/logs`
*   **Quyền truy cập:** Đăng nhập (USER, COACH)
