# Module 11: AI Integration (Tích hợp Trợ lý AI & Nhật ký)

Module này quản lý việc tích hợp Trợ lý AI (ví dụ: Google Gemini API) để tư vấn giáo án tập luyện và dinh dưỡng tự động cho người dùng, kèm theo ghi nhật ký sử dụng hệ thống để thống kê chi phí tài nguyên (tokens).

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `ai_logs`**: Lưu thông tin nhật ký giao tiếp với AI (`user_id`, `type` là WORKOUT hay NUTRITION, câu lệnh `prompt`, phản hồi `response` từ AI, số `tokens_used` và ngày tạo).

---

## 2. Các chức năng chính (Core Features)
*   Tích hợp SDK gọi Generative AI API (ví dụ: Gemini API) để tự động tạo giáo án tập luyện cá nhân hóa theo thông số chiều cao, cân nặng, mục tiêu của học viên.
*   Gọi AI tự thiết lập thực đơn ăn uống hàng ngày dựa trên lượng Kcal mục tiêu và chất dị ứng.
*   Ghi nhận toàn bộ thông số chi tiết (Prompt gửi đi, nội dung AI phản hồi, Token tiêu hao) vào bảng `ai_logs` sau mỗi phiên gọi AI.
*   Admin kiểm soát nhật ký AI để tính toán hóa đơn chi phí API hàng tháng.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Trợ lý AI (AI Assistant APIs)

#### 1. Yêu cầu AI tạo giáo án tập luyện tự động
*   **Endpoint:** `POST /api/ai/generate-workout`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Mô tả:** Nhận dữ liệu mục tiêu tập, gửi câu lệnh (Prompt) có cấu trúc chuẩn đến Gemini API. Nhận phản hồi dạng cấu trúc dữ liệu JSON để lưu vào database làm giáo án tập luyện cho hội viên.
*   **Request Body (JSON):**
    ```json
    {
      "goal": "Giảm mỡ bụng nhanh trong 1 tháng",
      "daysPerWeek": 3,
      "difficulty": "BEGINNER"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "AI đã tạo giáo án tập luyện thành công.",
      "data": {
        "title": "Kế hoạch giảm mỡ tối ưu 3 buổi/tuần",
        "durationWeeks": 4,
        "difficulty": "BEGINNER",
        "content": {
          "weeks": [
            {
              "week": 1,
              "days": [
                { "day": 1, "exercises": ["Squat 3 sets 12 reps", "Plank 3 sets 45s"] }
              ]
            }
          ]
        }
      }
    }
    ```

#### 2. Yêu cầu AI tạo thực đơn dinh dưỡng tự động
*   **Endpoint:** `POST /api/ai/generate-nutrition`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Request Body (JSON):**
    ```json
    {
      "calorieGoal": 1800,
      "proteinGoalG": 120,
      "restrictions": "Không ăn thịt lợn, dị ứng lạc"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "AI đã thiết lập thực đơn dinh dưỡng thành công.",
      "data": {
        "calorieGoal": 1800,
        "meals": {
          "breakfast": [
            { "foodName": "Oatmeal (Cháo yến mạch)", "weightG": 80, "calories": 300 }
          ],
          "lunch": [
            { "foodName": "Ức gà xào ớt chuông", "weightG": 200, "calories": 420 }
          ]
        }
      }
    }
    ```

---

### 3.2. API Nhật ký AI (AI Logs APIs - Admin Only)

#### 1. Lấy danh sách nhật ký sử dụng AI
*   **Endpoint:** `GET /api/ai/logs`
*   **Quyền truy cập:** ADMIN
*   **Query Params:** `userId`, `type` (`WORKOUT`, `NUTRITION`), `page`, `limit`
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy nhật ký sử dụng AI thành công.",
      "data": [
        {
          "id": "uuid-log-id",
          "userId": "uuid-user-id",
          "type": "WORKOUT",
          "prompt": "Hãy tạo giáo án giảm mỡ...",
          "tokensUsed": 1024,
          "createdAt": "2026-05-23T10:00:00.000Z"
        }
      ],
      "meta": {
        "page": 1,
        "limit": 10,
        "total": 350
      }
    }
    ```

#### 2. Xem chi tiết phản hồi của AI trong quá khứ (Phục vụ debug/lịch sử)
*   **Endpoint:** `GET /api/ai/logs/:id`
*   **Quyền truy cập:** ADMIN
