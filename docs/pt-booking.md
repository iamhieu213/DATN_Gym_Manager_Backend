# PT Booking API

Base path: `/pt-booking`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## Enum liên quan

- `PaymentMethod`: `CASH`, `VNPAY`, `MOMO`, `BANK_TRANSFER`
- **Trạng thái hợp đồng PT (Assignment Status):** `PENDING` (Chờ thanh toán), `ACTIVE` (Đang hoạt động), `COMPLETED` (Đã hoàn thành), `EXPIRED` (Hết hạn), `CANCELLED` (Đã hủy).
- **Trạng thái yêu cầu đổi PT (Change Request Status):** `PENDING` (Chờ duyệt), `REJECTED` (Đã từ chối), `APPROVED` (Đã duyệt), `AWAITING_PAYMENT` (Đang chờ thanh toán khoản chênh lệch).

---

## POST `/pt-booking/hire`

Hội viên đăng ký mua gói tập thuê PT (Huấn luyện viên cá nhân).

- **Quyền hạn:** Hội viên đã đăng nhập.
- **Request Body:**
  ```json
  {
    "coachId": 1,
    "ptPackageId": 1,
    "paymentMethod": "CASH"
  }
  ```
- **Thành công `201`:**
  ```json
  {
    "success": true,
    "message": "Đăng ký thuê PT thành công. Vui lòng tiến hành thanh toán.",
    "data": {
      "assignmentId": 1,
      "paymentId": 10,
      "amount": "3000000"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `HAVE_PENDING_ASSIGNMENT_LIMIT` (400): Có quá 3 hóa đơn thuê PT đang chờ thanh toán.
  - `ALREADY_HAVE_ACTIVE_COACH` (400): Đang có hợp đồng PT active khác (chỉ được thuê 1 PT tại một thời điểm).
  - `COACH_DOES_NOT_OFFER_PACKAGE` (400): PT này không đăng ký dạy gói PT mẫu này hoặc gói này đã bị khóa.

---

## GET `/pt-booking/my-coach`

Hội viên lấy thông tin hợp đồng PT đang hoạt động hiện tại.

- **Quyền hạn:** Hội viên đã đăng nhập.
- **Thành công `200`:** `data` là đối tượng CoachAssignment đang hoạt động cùng thông tin PT và gói tập, hoặc `null` nếu không thuê PT nào.

---

## GET `/pt-booking/my-bookings`

Hội viên xem lịch sử đăng ký thuê PT của bản thân.

- **Quyền hạn:** Hội viên đã đăng nhập.
- **Thành công `200`:** `data` là mảng danh sách các hợp đồng thuê PT.

---

## POST `/pt-booking/my-booking/:id/cancel`

Hội viên hủy đơn đăng ký thuê PT chưa thanh toán.

- **Quyền hạn:** Hội viên sở hữu hợp đồng thuê PT đó.
- **Path Param `id`:** ID hợp đồng (`CoachAssignment`).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Hủy đơn đăng ký thuê PT thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `ASSIGNMENT_NOT_FOUND` (404): Không tìm thấy hợp đồng.
  - `CANNOT_CANCEL_NON_PENDING_ASSIGNMENT` (400): Hợp đồng đã được thanh toán hoặc đã hoàn thành, không thể hủy.

---

## POST `/pt-booking/change-coach/:assignmentId`

Hội viên gửi yêu cầu đổi PT. 

- **Quyền hạn:** Hội viên sở hữu hợp đồng đó.
- **Logic xử lý:**
  - Nếu hợp đồng đang ở trạng thái **`PENDING`** (chưa thanh toán): Hệ thống cho phép đổi trực tiếp ngay lập tức, tự động cập nhật PT mới vào hóa đơn hiện tại (trả về `isDirectChange: true`).
  - Nếu hợp đồng đã **`ACTIVE`** (đã thanh toán & đang tập): Hệ thống sẽ tạo một yêu cầu đổi PT ở trạng thái `PENDING` để chờ Ban quản trị duyệt (trả về `isDirectChange: false`).
- **Request Body:**
  ```json
  {
    "newCoachId": 2,
    "newPtPackageId": 1,
    "paymentMethod": "VNPAY",
    "reason": "Tôi muốn thay đổi lịch tập phù hợp hơn."
  }
  ```
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Gửi yêu cầu đổi thành công...",
    "data": {
      "isDirectChange": false,
      "assignmentId": null,
      "requestId": 5,
      "paymentId": null
    }
  }
  ```

---

## GET `/pt-booking/my-students`

Huấn luyện viên xem danh sách các hội viên/học viên đang dạy.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`.
- **Thành công `200`:** `data` là mảng danh sách học viên active kèm thông tin chi tiết.

---

## POST `/pt-booking/admin/direct-change`

Ban quản trị đổi trực tiếp PT cho hội viên mà không cần hội viên gửi yêu cầu.

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Request Body:**
  ```json
  {
    "assignmentId": 1,
    "newCoachId": 2
  }
  ```
- **Thành công `200`:** Trả về đối tượng `CoachAssignment` sau khi cập nhật.

---

## PUT `/pt-booking/admin/change-request/:requestId/process`

Ban quản trị duyệt hoặc từ chối yêu cầu đổi PT của hội viên.

- **Quyền hạn:** `ADMIN`, `STAFF`.
- **Request Body:**
  ```json
  {
    "approve": true
  }
  ```
- **Logic xử lý chênh lệch giá:**
  - Nếu giá của gói PT mới của PT mới **lớn hơn** giá gói tập cũ: Yêu cầu sẽ được cập nhật trạng thái sang `AWAITING_PAYMENT` và tạo ra hóa đơn chênh lệch (`paymentId` trong data). Khi hóa đơn này được thanh toán, hợp đồng mới chính thức có hiệu lực.
  - Nếu giá nhỏ hơn hoặc bằng: Đổi trực tiếp và chuyển yêu cầu sang `APPROVED`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Duyệt yêu cầu đổi PT thành công.",
    "data": {
      "status": "APPROVED",
      "paymentId": null
    }
  }
  ```

---

## GET `/pt-booking/admin/change-requests`

Ban quản trị xem danh sách yêu cầu đổi PT.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF`: Tự động giới hạn chỉ xem các yêu cầu đổi PT có liên quan tới chi nhánh của mình (nghĩa là chi nhánh của PT cũ hoặc chi nhánh của PT mới trùng với chi nhánh của STAFF đó). Nếu STAFF chưa được gán chi nhánh, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN`: Xem toàn bộ yêu cầu trong hệ thống.
- **Query Parameters:**
  - `status` (optional): Lọc theo trạng thái yêu cầu (`PENDING`, `APPROVED`, `REJECTED`, `AWAITING_PAYMENT`).
- **Thành công `200`:** `data` là mảng danh sách yêu cầu đổi PT.

---

## GET `/pt-booking/admin/bookings`

Ban quản trị xem danh sách toàn bộ hợp đồng thuê PT.

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Phân vùng dữ liệu:**
    - Tài khoản `STAFF`: Chỉ được xem các hợp đồng thuê PT mà huấn luyện viên dạy lớp đó thuộc **chi nhánh của STAFF**. Nếu STAFF chưa được gán chi nhánh, trả lỗi `400 STAFF_BRANCH_REQUIRED`.
    - Tài khoản `ADMIN`: Xem toàn bộ danh sách hợp đồng thuê PT.
- **Query Parameters:**
  - `status` (optional): Lọc theo trạng thái hợp đồng.
- **Thành công `200`:** `data` là mảng danh sách hợp đồng thuê PT.
