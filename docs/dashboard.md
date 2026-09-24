# Dashboard API

Base path: `/dashboard`

Tài liệu này mô tả các API phục vụ trang thống kê quản trị (Dashboard). Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

Module chỉ đọc dữ liệu (không ghi database, không phát sự kiện, không dùng Redis và không có cache: mỗi request chạy lại toàn bộ truy vấn). Mọi mốc thời gian (đầu tháng, đầu năm, từng ngày/tháng/năm của biểu đồ) được tính theo **múi giờ của server**.

---

## GET `/dashboard/admin/stats`

Lấy toàn bộ dữ liệu thống kê quản trị phục vụ biểu đồ, chỉ số hoạt động, nhật ký hệ thống, giao dịch gần đây và danh sách huấn luyện viên nổi bật.

- **Quyền hạn:** `ADMIN` hoặc `STAFF`. Các role khác (`COACH`, `USER`) nhận `403`.
- **Query Parameters:**
  - `range` (optional): Khoảng thời gian thống kê của biểu đồ doanh thu `revenueChart`. Nhận một trong các giá trị:
    - `W` (Tuần - 7 ngày gần nhất, tính cả hôm nay)
    - `M` (Tháng - 12 tháng của năm hiện tại, đây là mặc định)
    - `Y` (Năm - 5 năm gần nhất, tính cả năm hiện tại)
  - `range` **không được validate**: bỏ trống, rỗng hoặc bất kỳ giá trị nào khác `W`/`Y` (kể cả giá trị sai như `X`) đều được xử lý như `M`. `range` chỉ ảnh hưởng tới `revenueChart`; các phần khác của response không đổi theo `range`.

### Cơ chế bảo mật & Ẩn thông tin tài chính (Masking Logic) cho `STAFF`
Để đảm bảo tính bảo mật của doanh nghiệp phòng tập, khi tài khoản có role `STAFF` gọi API này, hệ thống tự động lọc bỏ hoặc che giấu một phần thông tin tài chính (áp dụng sau khi tính toán, ngay trong controller):
- **Xóa các metric nhạy cảm:** `monthlyRevenue`, `monthlyRevenueGrowth`, `mrr`, `arpu`, `ltv` bị xóa khỏi object `metrics`. Các metric còn lại (`activeMembers`, `activeMembersGrowth`, `retentionRate`, `churnRate`) vẫn được trả về.
- **Ẩn biểu đồ doanh thu:** Trường `revenueChart` bị xóa khỏi phản hồi (không có key này trong `data`).
- **Che mờ số tiền giao dịch:** Trường `amount` của mọi phần tử trong `recentTransactions` bị thay bằng chuỗi `"******"`.
- **Không bị che:** `logs`, `trainers` và các trường còn lại của `recentTransactions` (`id`, `member`, `status`, `date`) được trả như của `ADMIN`. Lưu ý: log loại `payment` có `subtitle` chứa số tiền thanh toán (ví dụ `Mã HD #12 — 1.500.000đ từ Nguyen Van A`) và **không** bị che khi `STAFF` gọi.

---

### Ý nghĩa và công thức từng trường

#### `metrics`

| Trường | Kiểu | Ý nghĩa / công thức |
| --- | --- | --- |
| `activeMembers` | number | Số membership đang hiệu lực: `status = ACTIVE`, `is_active = true` và `end_date >= thời điểm hiện tại`. (`end_date` là cột kiểu ngày nên gói hết hạn đúng hôm nay đã không còn được tính.) |
| `activeMembersGrowth` | number (%) | Tăng trưởng so với tháng trước, làm tròn 1 chữ số thập phân: `(activeMembers - activeMembersLastMonth) / activeMembersLastMonth * 100`. Trong đó `activeMembersLastMonth` là số membership có `status` là `ACTIVE` hoặc `UPGRADED` và khoảng `start_date`..`end_date` giao với tháng trước (`start_date <= cuối tháng trước` và `end_date >= đầu tháng trước`). Nếu `activeMembersLastMonth = 0` thì trả `100` khi `activeMembers > 0`, ngược lại `0`. Có thể là số âm. |
| `monthlyRevenue` | number (VND) | Tổng `amount` của các payment `status = PAID` có `paid_at >= 00:00 ngày 1 của tháng hiện tại` (không có cận trên). |
| `monthlyRevenueGrowth` | number (%) | `(monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100`, làm tròn 1 chữ số thập phân; `lastMonthRevenue` là tổng payment `PAID` có `paid_at` trong tháng trước (từ đầu tháng trước đến trước đầu tháng này). Nếu `lastMonthRevenue = 0` thì trả `100` khi `monthlyRevenue > 0`, ngược lại `0`. |
| `churnRate` | number (%) | Tỉ lệ hủy gói: `số membership CANCELLED / tổng số membership (mọi trạng thái, mọi thời điểm) * 100`, làm tròn 1 chữ số thập phân. `0` nếu chưa có membership nào. |
| `retentionRate` | number (%) | Tỉ lệ giữ chân: `100 - churnRate`, làm tròn 1 chữ số thập phân (bằng `100` khi chưa có membership nào). |
| `mrr` | number (VND) | **Doanh thu trung bình mỗi tháng từ đầu năm đến nay**: `tổng payment PAID có paid_at >= 00:00 ngày 1/1 năm nay / số thứ tự tháng hiện tại (1..12)`, làm tròn về số nguyên. Đây không phải MRR theo nghĩa doanh thu định kỳ đăng ký, mà là trung bình doanh thu thực thu theo tháng (tháng hiện tại được tính là một tháng đủ). |
| `arpu` | number (VND) | Doanh thu trung bình trên mỗi hội viên đang hoạt động: `monthlyRevenue / activeMembers`, làm tròn số nguyên. `0` nếu `activeMembers = 0`. |
| `ltv` | number (VND) | Giá trị vòng đời khách hàng: `tổng payment PAID toàn thời gian / số user khác nhau đã có ít nhất một payment PAID`, làm tròn số nguyên. `0` nếu chưa có ai thanh toán. |

Tất cả các khoản doanh thu chỉ tính payment có `status = PAID` và lọc theo `paid_at`.

#### `revenueChart`

Mảng `{ label, value }`, `value` là tổng `amount` payment `PAID` (VND, number) có `paid_at` nằm trong khoảng tương ứng; khoảng không có doanh thu trả `0`.

| `range` | Số phần tử | Mỗi phần tử | `label` |
| --- | --- | --- | --- |
| `W` | 7 (từ 6 ngày trước đến hôm nay, cũ đến mới) | Một ngày (`00:00` đến trước `00:00` hôm sau) | Tên thứ trong tuần bằng `toLocaleDateString('vi-VN', { weekday: 'short' })`, ví dụ `Thứ 2`, ..., `Thứ 7`, `CN` (chuỗi cụ thể phụ thuộc dữ liệu locale của Node.js) |
| `M` (mặc định) | 12 (luôn đủ tháng 1 đến 12 của năm hiện tại, tháng chưa tới có `value = 0`) | Một tháng | `Th 1`, `Th 2`, ..., `Th 12` |
| `Y` | 5 (từ năm hiện tại - 4 đến năm hiện tại, cũ đến mới) | Một năm | Năm dạng chuỗi, ví dụ `"2026"` |

#### `logs`

Nhật ký hoạt động gần đây. Hệ thống lấy tối đa 2 bản ghi mới nhất của mỗi nguồn dưới đây, gộp lại, sắp xếp theo thời gian giảm dần và **chỉ giữ 4 dòng mới nhất**:

| `type` | Nguồn | `id` | `title` | `subtitle` |
| --- | --- | --- | --- | --- |
| `signup` | 2 user role `USER` mới tạo nhất (`createdAt`) | `signup-{userId}` | `Hội viên đăng ký mới` | `{tên} — Thành viên mới` |
| `payment` | 2 payment `PAID` có `paid_at` mới nhất | `payment-{paymentId}` | `Đã nhận thanh toán` | `Mã HD #{paymentId} — {số tiền định dạng vi-VN}đ từ {tên hội viên}` |
| `booking` | 2 `WorkoutSession` (buổi tập) tạo mới nhất, mọi trạng thái | `booking-{sessionId}` | `Lịch hẹn tập mới` | `Hội viên {tên} đặt buổi tập` |
| `alert` | 2 thiết bị có trạng thái `UNDER_MAINTENANCE` hoặc `OUT_OF_SERVICE` cập nhật gần nhất (`updatedAt`) | `alert-{equipmentId}` | `Cảnh báo thiết bị` | `{tên thiết bị} ({mã}) — Trạng thái: Đang bảo trì` hoặc `... Trạng thái: Hỏng hóc` |

Trường `time` là chuỗi thời gian tương đối so với thời điểm bản ghi (theo thứ tự ưu tiên từ lớn đến nhỏ): `{n} năm trước` (mỗi năm = 365 ngày), `{n} tháng trước` (mỗi tháng = 30 ngày), `{n} ngày trước`, `{n} giờ trước`, `{n} phút trước`, hoặc `Vừa xong` (dưới 1 phút). Thời điểm dùng để sắp xếp và tính `time` của từng loại: `signup` và `booking` dùng `createdAt`, `payment` dùng `paid_at`, `alert` dùng `updatedAt` của thiết bị. `logs` có thể ít hơn 4 phần tử nếu hệ thống ít dữ liệu.

#### `recentTransactions`

5 payment mới nhất theo `created_at` giảm dần, **mọi trạng thái** (gồm `PENDING`, `FAILED`, `REFUNDED`), mỗi phần tử:

| Trường | Ý nghĩa |
| --- | --- |
| `id` | `KN-{paymentId}` |
| `member` | Tên user sở hữu payment |
| `amount` | Số tiền đã định dạng vi-VN kèm ký hiệu, ví dụ `"1.500.000đ"` (chuỗi). Với `STAFF` là `"******"` |
| `status` | Trạng thái payment viết thường: `pending`, `paid`, `failed`, `refunded` |
| `date` | `paid_at` nếu có, ngược lại `created_at` (chuỗi ISO 8601) |

#### `trainers`

Tối đa 3 hồ sơ huấn luyện viên (`CoachProfile`) đầu tiên database trả về (không có `orderBy`, không lọc `isAvailable`), mỗi phần tử:

| Trường | Ý nghĩa |
| --- | --- |
| `name` | Tên của user HLV |
| `role` | `speciality` của hồ sơ HLV, nếu trống thì là `Huấn luyện viên` |
| `activeSlots` | Chuỗi `"{n} Lớp hoạt động"` với `n` là số hợp đồng PT (`CoachAssignment`) của HLV có `status = ACTIVE` |
| `rating` | **Giá trị cố định `5`** (chưa có dữ liệu đánh giá thật) |
| `image` | `avatarUrl` của user HLV, nếu trống thì dùng một URL ảnh mặc định cố định trong code |

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
      { "label": "Th 2", "value": 41000000 },
      { "label": "Th 3", "value": 0 }
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

Ví dụ trên rút gọn: `revenueChart` thực tế có đủ 12 phần tử với `range=M` (hoặc 7 với `W`, 5 với `Y`), `logs` tối đa 4 phần tử, `recentTransactions` tối đa 5 phần tử, `trainers` tối đa 3 phần tử.

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

- `403` (không có mã lỗi riêng): vai trò của user không phải `ADMIN` hoặc `STAFF`.
  ```json
  {
    "success": false,
    "message": "Bạn không có quyền truy cập dữ liệu quản trị."
  }
  ```
- `500`: lỗi khi truy vấn/tính toán dữ liệu. Trường `error` chứa thông điệp lỗi gốc (hoặc `INTERNAL_SERVER_ERROR` nếu không phải `Error`).
  ```json
  {
    "success": false,
    "message": "Lỗi hệ thống khi tải thông tin dashboard.",
    "error": "INTERNAL_SERVER_ERROR"
  }
  ```
- `401` (do `authMiddleware`, body không có `success`): thiếu Bearer token trả `{ "error": "Unauthorized" }`; token không hợp lệ hoặc hết hạn trả `{ "error": "Invalid token" }`.
