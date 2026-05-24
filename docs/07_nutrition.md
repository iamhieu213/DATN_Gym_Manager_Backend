# Module 7: Nutrition Plans (Quản lý Dinh dưỡng & Thực đơn)

Module này quản lý việc thiết kế kế hoạch dinh dưỡng (Nutrition Plans), thiết lập mục tiêu lượng Calo và các chất đa lượng (Carbs, Protein, Fat) hàng ngày phù hợp với thể trạng của hội viên.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `nutrition_plans`**: Lưu trữ chỉ tiêu dinh dưỡng hàng ngày (`calorie_goal`, `protein_g`, `carbs_g`, `fat_g`) và danh sách các bữa ăn đề xuất (`meals` dạng JSON).

---

## 2. Các chức năng chính (Core Features)
*   HLV thiết lập thực đơn ăn uống hàng ngày cho hội viên (Sáng, Trưa, Tối, Phụ).
*   Tích hợp AI tư vấn dinh dưỡng: Tự động tính toán nhu cầu năng lượng (TDEE) của hội viên dựa trên chiều cao, cân nặng, tần suất vận động và tạo thực đơn ăn kiêng/tăng cơ phù hợp bằng AI.
*   Hội viên xem chỉ tiêu dinh dưỡng và danh sách thực phẩm gợi ý để áp dụng hàng ngày.
*   Quản trị viên/HLV kiểm tra và điều chỉnh thực đơn dinh dưỡng định kỳ cho hội viên.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Dinh dưỡng (Nutrition Plans APIs)

#### 1. Tạo kế hoạch dinh dưỡng mới (PT thiết kế hoặc AI tạo)
*   **Endpoint:** `POST /api/nutrition/plans`
*   **Quyền truy cập:** COACH, ADMIN, hoặc USER (nếu dùng AI tự phục vụ)
*   **Request Body (JSON):**
    ```json
    {
      "userId": "uuid-member-id",
      "calorieGoal": 2200,
      "proteinG": 150.0,
      "carbsG": 220.0,
      "fatG": 65.0,
      "restrictions": "Không ăn hải sản, dị ứng đậu phộng",
      "aiGenerated": false,
      "meals": {
        "breakfast": [
          { "foodName": "Ức gà áp chảo", "weightG": 150, "calories": 250 },
          { "foodName": "Khoai lang luộc", "weightG": 100, "calories": 86 }
        ],
        "lunch": [
          { "foodName": "Cơm lứt", "weightG": 150, "calories": 165 },
          { "foodName": "Bò xào bông cải", "weightG": 150, "calories": 300 }
        ],
        "dinner": [
          { "foodName": "Cá hồi nướng", "weightG": 150, "calories": 280 }
        ]
      }
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Thiết lập kế hoạch dinh dưỡng thành công.",
      "data": {
        "id": "uuid-nutrition-plan-id",
        "calorieGoal": 2200,
        "isActive": true
      }
    }
    ```

#### 2. Lấy kế hoạch dinh dưỡng đang hoạt động của bản thân
*   **Endpoint:** `GET /api/nutrition/plans/active`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Response (JSON):** Trả về chi tiết lượng Calo cần nạp, tỉ lệ Macro (Carb/Protein/Fat) và danh sách chi tiết các bữa ăn được PT/AI lên lịch.

#### 3. PT lấy danh sách kế hoạch dinh dưỡng đã tạo cho học viên
*   **Endpoint:** `GET /api/nutrition/plans`
*   **Quyền truy cập:** COACH, ADMIN
*   **Query Params:** `userId` (lọc theo học viên)

#### 4. Cập nhật kế hoạch dinh dưỡng (PT/Admin cập nhật chỉ số hoặc thay đổi món ăn)
*   **Endpoint:** `PATCH /api/nutrition/plans/:id`
*   **Quyền truy cập:** COACH, ADMIN

#### 5. Hủy/Vô hiệu hóa kế hoạch dinh dưỡng cũ
*   **Endpoint:** `DELETE /api/nutrition/plans/:id` (Hoặc gửi PATCH đổi `is_active` thành false)
*   **Quyền truy cập:** COACH, ADMIN
