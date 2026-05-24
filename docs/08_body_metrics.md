# Module 8: Body Metrics (Theo dõi Chỉ số cơ thể & InBody)

Module này quản lý việc ghi nhận các chỉ số cơ thể của hội viên qua từng giai đoạn (chiều cao, cân nặng, tỷ lệ mỡ, tỷ lệ cơ, chỉ số BMI...) giúp hội viên và Huấn luyện viên theo dõi tiến trình tập luyện trực quan bằng biểu đồ.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `body_metrics`**: Lưu lịch sử đo đạc các chỉ số của người dùng (`weight_kg`, `height_cm`, `bmi`, `body_fat_pct`, `muscle_mass_kg`, `water_pct`, ghi chú và ngày đo).

---

## 2. Các chức năng chính (Core Features)
*   Hội viên tự ghi nhận cân nặng và chiều cao định kỳ để cập nhật chỉ số BMI.
*   Huấn luyện viên nhập các thông số chuyên sâu (InBody) đo được bằng máy quét tại phòng tập (Cơ, mỡ, nước cơ thể) cho học viên.
*   Hệ thống tự động tính toán chỉ số BMI dựa trên Cân nặng / (Chiều cao)².
*   Hội viên và HLV xem biểu đồ tiến trình biến động của Cân nặng, Tỷ lệ mỡ, Khối lượng cơ qua các tháng để điều chỉnh giáo án tập luyện và ăn uống.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Chỉ số cơ thể (Body Metrics APIs)

#### 1. Ghi nhận chỉ số cơ thể mới
*   **Endpoint:** `POST /api/metrics`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Mô tả:** Ghi nhận thông số cơ thể tại thời điểm hiện tại. Hệ thống tự động tính chỉ số BMI nếu có chiều cao và cân nặng.
*   **Request Body (JSON):**
    ```json
    {
      "userId": "uuid-member-id", // Mặc định là ID của chính mình nếu hội viên tự ghi
      "weightKg": 72.5,
      "heightCm": 175.0,
      "bodyFatPct": 18.2,
      "muscleMassKg": 34.8,
      "waterPct": 58.5,
      "note": "Đo vào buổi sáng lúc bụng rỗng."
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Ghi nhận chỉ số cơ thể thành công.",
      "data": {
        "id": "uuid-metric-id",
        "bmi": 23.67, // Tự động tính: 72.5 / (1.75 * 1.75)
        "recordedAt": "2026-05-23"
      }
    }
    ```

#### 2. Lấy lịch sử thay đổi chỉ số của bản thân (Để vẽ biểu đồ)
*   **Endpoint:** `GET /api/metrics/my-history`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `startDate`, `endDate`, `limit` (mặc định lấy 30 bản ghi gần nhất để vẽ đồ thị).
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy lịch sử chỉ số cơ thể thành công.",
      "data": [
        {
          "recordedAt": "2026-04-23",
          "weightKg": 75.0,
          "bmi": 24.49,
          "bodyFatPct": 20.1
        },
        {
          "recordedAt": "2026-05-23",
          "weightKg": 72.5,
          "bmi": 23.67,
          "bodyFatPct": 18.2
        }
      ]
    }
    ```

#### 3. PT xem lịch sử chỉ số của học viên đang kèm cặp
*   **Endpoint:** `GET /api/metrics/user/:userId`
*   **Quyền truy cập:** COACH (PT đang kèm cặp học viên đó), ADMIN, STAFF
*   **Query Params:** `limit`, `page`

#### 4. Xóa một bản ghi chỉ số bị nhập sai
*   **Endpoint:** `DELETE /api/metrics/:id`
*   **Quyền truy cập:** Đăng nhập (Hội viên tự xóa chỉ số của mình hoặc PT/Admin xóa chỉ số đã nhập hộ).
