# DATN Gym Manager - Tài liệu Đặc tả các Module & API Backend

Hệ thống quản lý phòng Gym (DATN Gym Manager Backend) được thiết kế theo cấu trúc modular, phân tách rõ ràng các thực thể dựa trên cơ sở dữ liệu quan hệ PostgreSQL (Prisma ORM).

Dưới đây là danh sách các tài liệu phân tích chi tiết tính năng và thiết kế API của từng module. Hãy click vào từng liên kết dưới đây để xem chi tiết:

---

## 🧭 Danh mục các Module tài liệu (Table of Contents)

1.  **[Module 1: Xác thực & Quản lý Người dùng (Auth & User)](file:///d:/DATN/GYM-Backend/docs/01_auth_user.md)**
    *   *Nghiệp vụ:* Đăng ký/Đăng nhập, OTP Email, Đăng nhập Google, Đổi/Quên mật khẩu, Profile cá nhân, Quản lý tài khoản (Admin/Staff), Soft Delete.
2.  **[Module 2: Gói tập & Thanh toán (Membership Plans & Payments)](file:///d:/DATN/GYM-Backend/docs/02_membership_plans.md)**
    *   *Nghiệp vụ:* Cấu hình gói tập (Cardio, PT, Yoga), Mua gói tập, Tích hợp cổng thanh toán online (VNPAY / MOMO) và Xác nhận tiền mặt tại quầy.
3.  **[Module 3: Huấn luyện viên (Coach & PT)](file:///d:/DATN/GYM-Backend/docs/03_coach.md)**
    *   *Nghiệp vụ:* Hồ sơ chuyên môn của PT, Mức phí, Đánh giá rating, và Phân công HLV kèm cặp học viên.
4.  **[Module 4: Điểm danh & Ra vào (Checkins & Attendance)](file:///d:/DATN/GYM-Backend/docs/04_checkins.md)**
    *   *Nghiệp vụ:* Quét mã QR Check-in/Check-out động, kiểm soát trạng thái thẻ tập khi vào cửa, đếm thời gian tập.
5.  **[Module 5: Lớp học nhóm & Đặt chỗ (Group Classes & Bookings)](file:///d:/DATN/GYM-Backend/docs/05_group_classes.md)**
    *   *Nghiệp vụ:* Lịch dạy các lớp Yoga, Zumba, v.v., Đặt chỗ tham gia, Hủy chỗ, và PT điểm danh lớp học.
6.  **[Module 6: Kế hoạch Tập luyện (Workout Plans & Logs)](file:///d:/DATN/GYM-Backend/docs/06_workout.md)**
    *   *Nghiệp vụ:* Lập giáo án tập luyện tuần/tháng (bởi PT hoặc AI), Ghi nhật ký bài tập (Sets, Reps, Weight) thực tế.
7.  **[Module 7: Kế hoạch Dinh dưỡng (Nutrition Plans)](file:///d:/DATN/GYM-Backend/docs/07_nutrition.md)**
    *   *Nghiệp vụ:* Lập thực đơn dinh dưỡng (Kcal mục tiêu, Carbs/Protein/Fat), đề xuất bữa ăn (bởi PT hoặc AI).
8.  **[Module 8: Theo dõi Chỉ số Cơ thể (Body Metrics - InBody)](file:///d:/DATN/GYM-Backend/docs/08_body_metrics.md)**
    *   *Nghiệp vụ:* Nhật ký chỉ số cơ thể, InBody (Cơ, Mỡ, Nước, Cân nặng, Chiều cao, BMI) và Vẽ biểu đồ biến động.
9.  **[Module 9: Quản lý Thiết bị & Máy tập (Equipment Management)](file:///d:/DATN/GYM-Backend/docs/09_equipment.md)**
    *   *Nghiệp vụ:* Quản lý danh mục thiết bị, Máy tập, Trạng thái (Hỏng, Tốt), Lịch bảo trì định kỳ.
10. **[Module 10: Tin nhắn & Thông báo (Messages & Notifications)](file:///d:/DATN/GYM-Backend/docs/10_notifications_messages.md)**
    *   *Nghiệp vụ:* Chat nội bộ trực tiếp giữa Học viên & PT, Gửi thông báo hệ thống tự động (lịch tập, nhắc đóng tiền...).
11. **[Module 11: Nhật ký tích hợp AI (AI Integration Logs)](file:///d:/DATN/GYM-Backend/docs/11_ai_integration.md)**
    *   *Nghiệp vụ:* Theo dõi các lượt gọi API của Trợ lý AI (Gemini), lưu Prompt/Response và đếm Tokens sử dụng.

---

## 🛠️ Quy chuẩn chung trong thiết kế API
*   **Mã định danh (ID):** Thiết kế database SQL của bạn sử dụng định dạng **`UUID`** (ví dụ: `gen_random_uuid()`) cho khóa chính ở tất cả các bảng. Do đó, tất cả các API RESTful nhận diện ID ở URL Params sẽ được truyền dạng chuỗi UUID.
*   **Dạng dữ liệu trả về (Response Standard):** Tất cả các API nên trả về chung một định dạng JSON chuẩn hóa:
    *   Thành công: `{ "success": true, "message": "...", "data": ... }`
    *   Thất bại: `{ "success": false, "message": "...", "error": "MÃ_LỖI" }`
*   **Bảo mật:** Tất cả các API yêu cầu đăng nhập cần đính kèm JWT token ở Header dạng `Authorization: Bearer <access_token>`.
