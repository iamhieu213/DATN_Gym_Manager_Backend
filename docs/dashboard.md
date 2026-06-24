# Dashboard API

Base path: `/dashboard`

Tài liệu này mô tả các API phục vụ trang thống kê quản trị (Dashboard). Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

---

## GET `/dashboard/admin/stats`

Lấy toàn bộ dữ liệu thống kê quản trị phục vụ biểu đồ, chỉ số hoạt động, nhật ký hệ thống, giao dịch gần đây và danh sách huấn luyện viên nổi bật.

- **Quyền hạn:** `ADMIN` hoặc `STAFF`.
- **Query Parameters:**
  - `range` (optional): Khoảng thời gian thống kê biểu đồ doanh thu. Nhận một trong các giá trị:
    - `W` (Tuần - 7 ngày gần nhất)
    - `M` (Tháng - 12 tháng trong năm hiện tại, đây là mặc định)
    - `Y` (Năm - 5 năm gần nhất)

### Cơ chế bảo mật & Ẩn thông tin tài chính (Masking Logic) cho `STAFF`
Để đảm bảo tính bảo mật của doanh nghiệp phòng tập, khi tài khoản có role `STAFF` gọi API này, hệ thống sẽ tự động lọc bỏ hoặc che giấu thông tin tài chính:
- **Xóa các metric nhạy cảm:** `monthlyRevenue`, `monthlyRevenueGrowth`, `mrr`, `arpu`, `ltv` sẽ bị xóa khỏi object `metrics`.
- **Ẩn biểu đồ doanh thu:** Trường `revenueChart` sẽ bị xóa khỏi phản hồi.
- **Che mờ số tiền giao dịch:** Trường `amount` của các giao dịch trong `recentTransactions` sẽ bị thay thế hoàn toàn bằng chuỗi `"******"`.

---

### Thành công `200` (Phản hồi cho ADMIN)

```json
{
  "success": true,
  "data": {
    "metrics": {
      "activeMembers": 150,
      "activeMembersGrowth": 12.5,
      "monthlyRevenue": 45000000,
      "monthlyRevenueGrowth": 8.2,
      "retentionRate": 95.5,
      "churnRate": 4.5,
      "mrr": 42000000,
      "arpu": 300000,
      "ltv": 2500000
    },
    "revenueChart": [
      { "label": "Th 1", "value": 38000000 },
      { "label": "Th 2", "value": 41000000 }
      // ... 12 tháng hoặc theo range yêu cầu
    ],
    "logs": [
      {
        "id": "payment-12",
        "type": "payment",
        "title": "Đã nhận thanh toán",
        "subtitle": "Mã HD #12 — 1.500.000đ từ Nguyen Van A",
        "time": "10 phút trước"
      },
      {
        "id": "signup-34",
        "type": "signup",
        "title": "Hội viên đăng ký mới",
        "subtitle": "Tran Thi B — Thành viên mới",
        "time": "1 giờ trước"
      }
    ],
    "recentTransactions": [
      {
        "id": "KN-12",
        "member": "Nguyen Van A",
        "amount": "1.500.000đ",
        "status": "paid",
        "date": "2026-06-24T12:00:00.000Z"
      }
    ],
    "trainers": [
      {
        "name": "HLV Nguyễn Văn Hùng",
        "role": "Thể hình / Tăng cơ",
        "activeSlots": "5 Lớp hoạt động",
        "rating": 5,
        "image": "https://url-anh-dai-dien.png"
      }
    ]
  }
}
```

---

### Thành công `200` (Phản hồi che thông tin cho STAFF)

```json
{
  "success": true,
  "data": {
    "metrics": {
      "activeMembers": 150,
      "activeMembersGrowth": 12.5,
      "retentionRate": 95.5,
      "churnRate": 4.5
    },
    "logs": [
      {
        "id": "signup-34",
        "type": "signup",
        "title": "Hội viên đăng ký mới",
        "subtitle": "Tran Thi B — Thành viên mới",
        "time": "1 giờ trước"
      }
    ],
    "recentTransactions": [
      {
        "id": "KN-12",
        "member": "Nguyen Van A",
        "amount": "******",
        "status": "paid",
        "date": "2026-06-24T12:00:00.000Z"
      }
    ],
    "trainers": [
      {
        "name": "HLV Nguyễn Văn Hùng",
        "role": "Thể hình / Tăng cơ",
        "activeSlots": "5 Lớp hoạt động",
        "rating": 5,
        "image": "https://url-anh-dai-dien.png"
      }
    ]
  }
}
```

---

### Lỗi thường gặp

- `FORBIDDEN` (403): Trả về khi vai trò của user không phải `ADMIN` hoặc `STAFF`.
  ```json
  {
    "success": false,
    "message": "Bạn không có quyền truy cập dữ liệu quản trị."
  }
  ```
- `UNAUTHORIZED` (401): Khi chưa truyền Bearer token hợp lệ.
