# Module 4: Checkins & Attendance (Quản lý Điểm danh & Ra vào)

Module này quản lý việc quét mã kiểm soát ra/vào (Checkin/Checkout) của hội viên khi đến tập luyện tại phòng gym, giúp thống kê thời lượng tập và kiểm soát vé/gói tập còn hạn.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `checkins`**: Ghi nhận thời gian bắt đầu vào tập (`checkin_time`), thời gian ra về (`checkout_time`) và tính toán tổng thời gian tập luyện tính theo phút (`duration_minutes`).

---

## 2. Các chức năng chính (Core Features)
*   Tạo mã QR Check-in động cho hội viên trên ứng dụng di động (thay đổi liên tục để tránh chụp màn hình gửi cho người khác).
*   Lễ tân tại quầy hoặc máy quét tự động ở cổng quét mã QR để ghi nhận **Check-in**:
    *   Hệ thống tự động kiểm tra xem hội viên có gói tập (`Membership`) nào đang còn hạn (`ACTIVE`) hay không.
    *   Nếu hợp lệ, ghi nhận thời gian vào cửa và mở cổng. Nếu không hợp lệ (hết hạn, chưa đóng tiền...), hệ thống cảnh báo và từ chối vào cửa.
*   Quét mã khi ra về để ghi nhận **Check-out**:
    *   Tính toán thời lượng buổi tập (`checkout_time` - `checkin_time`) và lưu vào cơ sở dữ liệu.
*   Hội viên xem lịch sử điểm danh và thống kê thời lượng rèn luyện của bản thân.
*   Quản trị viên xem báo cáo mật độ hội viên trong phòng tập theo giờ và lịch sử ra vào.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Điểm danh (Checkin APIs)

#### 1. Yêu cầu tạo mã QR Check-in động (Hội viên tự lấy)
*   **Endpoint:** `GET /api/checkins/qr-code`
*   **Quyền truy cập:** Đăng nhập (Role USER)
*   **Mô tả:** Trả về một mã token/QR có chữ ký bảo mật và thời gian hết hạn trong 30 giây để hiển thị lên app di động.
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Tạo mã QR check-in thành công.",
      "data": {
        "qrToken": "signed-qr-token-string",
        "expiresIn": 30
      }
    }
    ```

#### 2. Thực hiện Check-in (Quét mã ở cổng/Lễ tân quét)
*   **Endpoint:** `POST /api/checkins/checkin`
*   **Quyền truy cập:** ADMIN, STAFF, cổng tự động (máy quét)
*   **Mô tả:** Giải mã mã QR của hội viên, kiểm tra xem họ có gói tập còn hạn không. Nếu hợp lệ, lưu lịch sử check-in mới với trạng thái chưa checkout.
*   **Request Body (JSON):**
    ```json
    {
      "qrToken": "signed-qr-token-string"
    }
    ```
*   **Response (JSON - Thành công):**
    ```json
    {
      "success": true,
      "message": "Check-in thành công! Chào mừng hội viên Nguyễn Văn A.",
      "data": {
        "checkinId": "uuid-checkin-id",
        "userId": "uuid-user-id",
        "name": "Nguyễn Văn A",
        "checkinTime": "2026-05-23T08:30:00.000Z"
      }
    }
    ```
*   **Response (JSON - Thất bại do hết hạn gói):**
    ```json
    {
      "success": false,
      "message": "Không thể check-in. Gói tập của hội viên đã hết hạn hoặc chưa thanh toán.",
      "error": "MEMBERSHIP_EXPIRED"
    }
    ```

#### 3. Thực hiện Check-out (Quét mã lúc ra về)
*   **Endpoint:** `POST /api/checkins/checkout`
*   **Quyền truy cập:** ADMIN, STAFF, cổng tự động (máy quét)
*   **Mô tả:** Ghi nhận giờ ra về cho buổi tập gần nhất chưa check-out của người dùng, tính tổng thời gian tập.
*   **Request Body (JSON):**
    ```json
    {
      "userId": "uuid-user-id"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Check-out thành công. Hẹn gặp lại quý khách!",
      "data": {
        "checkinId": "uuid-checkin-id",
        "checkoutTime": "2026-05-23T10:00:00.000Z",
        "durationMinutes": 90
      }
    }
    ```

#### 4. Hội viên xem lịch sử điểm danh của bản thân
*   **Endpoint:** `GET /api/checkins/my-history`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `startDate`, `endDate`, `limit`, `page`

#### 5. Quản trị viên xem báo cáo hoạt động ra vào toàn bộ phòng tập
*   **Endpoint:** `GET /api/checkins`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Query Params:** `userId`, `date` (lọc theo ngày cụ thể), `page`, `limit`
*   **Mô tả:** Lấy danh sách toàn bộ các lượt ra vào để hiển thị biểu đồ tần suất tập luyện.
