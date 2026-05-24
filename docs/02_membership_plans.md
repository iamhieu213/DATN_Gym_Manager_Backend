# Module 2: Membership Plans & Payments (Quản lý gói tập & Thanh toán)

Module này quản lý việc tạo các gói tập gym (Plans), việc hội viên đăng ký mua gói tập (Memberships) và lịch sử giao dịch thanh toán (Payments) bằng nhiều phương thức khác nhau.

---

## 1. Cơ sở dữ liệu liên quan (Database Schema)
*   **Bảng `plans`**: Lưu trữ danh sách các gói dịch vụ phòng tập (tên, giá, thời hạn ngày, tính năng...).
*   **Bảng `memberships`**: Liên kết người dùng với một gói tập và thời hạn hiệu lực (`start_date` đến `end_date`).
*   **Bảng `payments`**: Lưu thông tin hóa đơn thanh toán giao dịch (số tiền, phương thức, trạng thái thanh toán, mã giao dịch của đối tác Momo/VNPAY).

---

## 2. Các chức năng chính (Core Features)
*   Quản trị viên cấu hình các gói tập của phòng Gym (Thêm, Sửa, Ẩn/Hiện gói tập, Định giá).
*   Hội viên xem danh sách các gói tập đang mở bán.
*   Hội viên đăng ký mua gói tập (Tạo Membership ở trạng thái `PENDING` và lập hóa đơn Payment ở trạng thái `PENDING`).
*   Thanh toán hóa đơn:
    *   **Thanh toán tiền mặt/chuyển khoản trực tiếp tại quầy:** Staff xác nhận đã nhận tiền và cập nhật trạng thái hóa đơn sang `PAID`, kích hoạt Membership sang `ACTIVE`.
    *   **Thanh toán qua cổng online (VNPAY / MOMO):** Tích hợp SDK tạo URL thanh toán, nhận kết quả Callback/IPN từ cổng để tự động đổi trạng thái hóa đơn thành `PAID` và kích hoạt Membership ngay lập tức.
*   Hội viên xem lịch sử mua gói tập và lịch sử thanh toán của mình.
*   Admin/Staff kiểm tra danh sách doanh thu phòng tập và quản lý các giao dịch.

---

## 3. Danh sách thiết kế API (API Reference)

### 3.1. API Quản lý Gói tập (Plans APIs)

#### 1. Lấy danh sách gói tập đang mở bán (Dành cho khách hàng/hội viên)
*   **Endpoint:** `GET /api/plans`
*   **Quyền truy cập:** Public
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Lấy danh sách gói tập thành công.",
      "data": [
        {
          "id": "uuid-plan-1",
          "name": "Gói Standard 1 Tháng",
          "description": "Tập luyện tự do không giới hạn khung giờ.",
          "price": 500000.00,
          "duration_days": 30,
          "features": ["Tập tự do", "Free tủ đồ", "Free nước uống"],
          "is_active": true
        }
      ]
    }
    ```

#### 2. Thêm mới gói tập (Admin/Staff)
*   **Endpoint:** `POST /api/plans`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Request Body (JSON):**
    ```json
    {
      "name": "Gói PT 1 Kèm 1 - 10 Buổi",
      "description": "Tập cùng Huấn luyện viên cá nhân chuyên nghiệp.",
      "price": 4000000.00,
      "duration_days": 45,
      "features": ["10 buổi với PT", "Đo InBody miễn phí"]
    }
    ```

#### 3. Cập nhật gói tập (Admin/Staff)
*   **Endpoint:** `PATCH /api/plans/:id`
*   **Quyền truy cập:** ADMIN, STAFF

#### 4. Xóa/Ẩn gói tập (Ngừng bán)
*   **Endpoint:** `DELETE /api/plans/:id` (Hoặc gửi PATCH đổi `is_active` thành false)
*   **Quyền truy cập:** ADMIN, STAFF

---

### 3.2. API Đăng ký Gói tập (Memberships APIs)

#### 1. Hội viên đăng ký mua gói tập
*   **Endpoint:** `POST /api/memberships/subscribe`
*   **Quyền truy cập:** Đăng nhập (All Roles)
*   **Mô tả:** Đăng ký một gói tập. Hệ thống tạo bản ghi Membership với trạng thái `PENDING` và trả về thông tin hóa đơn cần thanh toán.
*   **Request Body (JSON):**
    ```json
    {
      "planId": "uuid-plan-1"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Đăng ký gói tập thành công. Vui lòng thanh toán hóa đơn.",
      "data": {
        "membershipId": "uuid-membership-id",
        "planName": "Gói Standard 1 Tháng",
        "startDate": "2026-05-23",
        "endDate": "2026-06-22",
        "status": "PENDING",
        "payment": {
          "paymentId": "uuid-payment-id",
          "amount": 500000.00,
          "status": "PENDING"
        }
      }
    }
    ```

#### 2. Hội viên xem lịch sử gói tập của mình
*   **Endpoint:** `GET /api/memberships/my-history`
*   **Quyền truy cập:** Đăng nhập (All Roles)

#### 3. Quản trị viên lấy danh sách tất cả các lượt đăng ký gói tập
*   **Endpoint:** `GET /api/memberships`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Query Params:** `page`, `limit`, `status` (`ACTIVE`, `EXPIRED`, `PENDING`), `userId`

---

### 3.3. API Thanh toán (Payments APIs)

#### 1. Tạo liên kết thanh toán online (VNPAY/MOMO)
*   **Endpoint:** `POST /api/payments/:paymentId/pay-online`
*   **Quyền truy cập:** Đăng nhập
*   **Mô tả:** Tạo URL để chuyển hướng khách hàng sang trang cổng thanh toán VNPay hoặc Momo.
*   **Request Body (JSON):**
    ```json
    {
      "method": "VNPAY" // Hoặc "MOMO"
    }
    ```
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Tạo URL thanh toán thành công.",
      "data": {
        "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
      }
    }
    ```

#### 2. Nhận phản hồi thanh toán từ Cổng VNPay (IPN / Return URL Callback)
*   **Endpoint:** `GET /api/payments/vnpay-callback`
*   **Quyền truy cập:** Public (Cổng VNPay gọi)
*   **Mô tả:** VNPay gọi về để thông báo trạng thái giao dịch. Backend kiểm tra chữ ký bảo mật, cập nhật trạng thái hóa đơn thành `PAID` và kích hoạt gói tập (`is_active = true`, `status = ACTIVE`) nếu giao dịch thành công.

#### 3. Nhân viên xác nhận thanh toán trực tiếp bằng Tiền mặt (tại quầy)
*   **Endpoint:** `POST /api/payments/:paymentId/confirm-cash`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Mô tả:** Khách hàng đưa tiền mặt hoặc chuyển khoản trực tiếp qua tài khoản ngân hàng của phòng gym tại quầy lễ tân. Nhân viên nhấn nút xác nhận để kích hoạt gói tập cho khách.
*   **Response (JSON):**
    ```json
    {
      "success": true,
      "message": "Xác nhận thanh toán tiền mặt thành công. Gói tập đã được kích hoạt.",
      "data": {
        "paymentId": "uuid-payment-id",
        "status": "PAID"
      }
    }
    ```

#### 4. Xem danh sách toàn bộ hóa đơn/doanh thu (Admin/Staff)
*   **Endpoint:** `GET /api/payments`
*   **Quyền truy cập:** ADMIN, STAFF
*   **Query Params:** `status` (`PENDING`, `PAID`, `FAILED`), `startDate`, `endDate`
