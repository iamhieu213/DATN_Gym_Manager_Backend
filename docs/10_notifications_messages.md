# Module 10: Messages & Notifications (Nhắn tin & Thông báo)

Module này quản lý việc trao đổi tin nhắn trực tiếp giữa hội viên với Huấn luyện viên kèm cặp, và hệ thống gửi/hiển thị thông báo (như lịch hẹn, nhắc thanh toán, lịch tập).

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `messages`**: Lưu trữ lịch sử tin nhắn nội bộ (`sender_id`, `receiver_id`, nội dung tin nhắn, trạng thái đã đọc và thời gian gửi).
*   **Bảng `notifications`**: Lưu trữ thông báo của hệ thống gửi riêng cho từng người dùng (`user_id`, tiêu đề, nội dung, loại thông báo và trạng thái đã đọc).

---

## 2. Các chức năng chính (Core Features)
*   Hội viên và PT nhắn tin trò chuyện trao đổi về giáo án tập luyện, tiến trình sức khỏe hoặc lịch hẹn.
*   *Khuyến nghị tích hợp:* Hỗ trợ WebSockets (Socket.io) để chat thời gian thực (real-time chat).
*   Hệ thống gửi thông báo tự động cho người dùng khi:
    *   Thanh toán gói tập thành công hoặc gói tập sắp hết hạn.
    *   Có lịch đặt chỗ lớp học nhóm thành công hoặc lớp học bị hủy.
    *   PT chỉ định giáo án tập luyện mới hoặc thay đổi thực đơn ăn uống.
*   Người dùng xem danh sách thông báo và đánh dấu đã đọc thông báo.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Nhắn tin (Messages APIs)

#### 1. Gửi tin nhắn mới
*   **Endpoint:** `POST /api/messages`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Request Body (JSON):**
    ```json
    {
      "receiverId": "uuid-receiver-user-id",
      "content": "Chào Coach, hôm nay em bận nên xin phép lùi lịch tập sang ngày mai nhé."
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Gửi tin nhắn thành công.",
      "data": {
        "id": "uuid-message-id",
        "senderId": "uuid-sender-id",
        "receiverId": "uuid-receiver-user-id",
        "content": "...",
        "isRead": false,
        "sentAt": "2026-05-23T10:00:00.000Z"
      }
    }
    ```

#### 2. Lấy lịch sử đoạn chat giữa 2 người (Hội viên & PT)
*   **Endpoint:** `GET /api/messages/chat/:partnerId`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `limit`, `before` (thời gian của tin nhắn cũ nhất để cuộn trang lấy tiếp tin nhắn cũ).
*   **Response (JSON):** Trả về danh sách tin nhắn giữa tài khoản hiện tại và `partnerId` sắp xếp theo thời gian tăng dần.

#### 3. Đánh dấu đã đọc toàn bộ tin nhắn từ một người
*   **Endpoint:** `PATCH /api/messages/read/:senderId`
*   **Quyền truy cập:** Đăng nhập (All Roles)

---

### 3.2. API Thông báo hệ thống (Notifications APIs)

#### 1. Lấy danh sách thông báo của bản thân
*   **Endpoint:** `GET /api/notifications`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Query Params:** `page`, `limit`, `isRead` (lọc thông báo chưa đọc hoặc đã đọc).
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy danh sách thông báo thành công.",
      "data": [
        {
          "id": "uuid-notification-id",
          "title": "Nhắc nhở lịch tập",
          "body": "Bạn có lịch tập buổi 'Ngực & Tay sau' vào lúc 18:00 ngày hôm nay.",
          "type": "WORKOUT_REMINDER",
          "isRead": false,
          "createdAt": "2026-05-23T07:00:00.000Z"
        }
      ]
    }
    ```

#### 2. Đánh dấu một thông báo đã đọc
*   **Endpoint:** `PATCH /api/notifications/:id/read`
*   **Quyền truy cập:** Đăng nhập (All Roles)

#### 3. Đánh dấu đã đọc tất cả thông báo của bản thân
*   **Endpoint:** `PATCH /api/notifications/read-all`
*   **Quyền truy cập:** Đăng nhập (All Roles)

#### 4. Gửi thông báo thủ công cho một người dùng (Admin gửi)
*   **Endpoint:** `POST /api/notifications`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "userId": "uuid-user-id",
      "title": "Thông báo từ Ban quản lý",
      "body": "Phòng tập sẽ đóng cửa bảo trì máy lạnh vào sáng Chủ Nhật tuần này.",
      "type": "SYSTEM"
    }
    ```
