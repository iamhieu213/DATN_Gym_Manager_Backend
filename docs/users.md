# Users API

Base path: `/users`

Tất cả API trong module này đều yêu cầu đăng nhập bằng Bearer token.

- Thiếu header `Authorization: Bearer <token>` -> `401` với body `{ "error": "Unauthorized" }`.
- Token sai/hết hạn/payload không hợp lệ -> `401` với body `{ "error": "Invalid token" }`.
- Cả hai trường hợp trên do `authMiddleware` trả về, **không** có `success`/`message`. `role` của người gọi lấy từ token (không truy vấn lại DB) và middleware không kiểm tra `status` của tài khoản.

---

## Kiểu dữ liệu User trả về

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Nguyen Van A",
  "phone": "0900000000",
  "dateOfBirth": "2000-01-01T00:00:00.000Z",
  "role": "USER",
  "status": "ACTIVE",
  "avatarUrl": null,
  "gender": "MALE",
  "citizenId": null,
  "address": null,
  "emergencyContact": null,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

- Các trường có thể `null`: `phone`, `dateOfBirth`, `avatarUrl`, `gender`, `citizenId`, `address`, `emergencyContact`.
- Các trường **không** bao giờ được trả về: `passwordHash`, `googleId`, `emailVerifiedAt`.
- Tên trường là camelCase.

### Các Enum liên quan
- **`role`:** `ADMIN` (Quản trị hệ thống), `COACH` (Huấn luyện viên/PT), `STAFF` (Nhân viên/Lễ tân), `USER` (Hội viên).
- **`status`:** `ACTIVE`, `INACTIVE`, `SUSPENDED` (Tạm ngưng), `BANNED` (Bị cấm), `DELETED` (Đã xóa mềm).
- **`gender`:** `MALE`, `FEMALE`, `OTHER`.

### Ràng buộc dữ liệu (DB)
- `email`, `phone`, `citizenId` là **unique** trên toàn bảng `users`. Service kiểm tra trước khi ghi và trả `409` (`EMAIL_ALREADY_EXISTS`, `PHONE_ALREADY_EXISTS`, `CITIZEN_ID_ALREADY_EXISTS`).
- Độ dài tối đa của cột: `email` 255, `name` 255, `phone` 30, `citizenId` 50, `address` 255, `emergencyContact` 255, `avatarUrl` 255. Vượt quá giới hạn không được kiểm tra ở API và sẽ gây lỗi `500`.

### Định dạng lỗi & mã lỗi chung

Response lỗi do controller trả về có dạng:

```json
{
  "success": false,
  "message": "Bạn không có quyền thực hiện chức năng này.",
  "error": "FORBIDDEN"
}
```

| `error` | HTTP | `message` |
| --- | --- | --- |
| `UNAUTHORIZED` | `401` | Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn. |
| `FORBIDDEN` | `403` | Bạn không có quyền thực hiện chức năng này. |
| `USER_NOT_FOUND` | `404` | Không tìm thấy thông tin người dùng. |
| `EMAIL_ALREADY_EXISTS` | `409` | Email này đã tồn tại trong hệ thống. |
| `PHONE_ALREADY_EXISTS` | `409` | Số điện thoại này đã tồn tại trong hệ thống. |
| `CITIZEN_ID_ALREADY_EXISTS` | `409` | Số CCCD này đã tồn tại trong hệ thống. |
| `BAD_REQUEST` | `400` | Yêu cầu không hợp lệ. (riêng avatar dùng message "Vui lòng chọn một file ảnh để tải lên.") |
| `INVALID_ID` | `400` | ID người dùng không hợp lệ. |
| (lỗi khác) | `500` | Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau. |

Lưu ý chung:
- Với lỗi `500` không nằm trong bảng, trường `error` chứa nguyên văn `message` của exception (ví dụ `Cannot read properties of undefined (reading 'email')`).
- Module **không có bước validate** kiểu dữ liệu/enum ở tầng API. Giá trị sai kiểu hoặc sai enum (`role`, `status`, `gender`, ngày không parse được...) được chuyển thẳng xuống Prisma và thường trả `500`.
- Các endpoint đọc body (`PATCH /users/me`, `POST /users`, `PATCH /users/:id`, `PATCH /users/:id/status`, `POST /users/:id/reset-password`) cần gửi `Content-Type: application/json`. Nếu không có body JSON thì `req.body` là `undefined` và request trả `500`. Body JSON sai cú pháp bị Express trả `400` theo định dạng mặc định (không phải JSON của API).
- `:id` được đọc bằng `parseInt(id, 10)`: chỉ giá trị parse ra `NaN` mới bị `400 INVALID_ID` (ví dụ `12abc` được hiểu là `12`). ID không tồn tại (kể cả `0`, số âm) -> `404 USER_NOT_FOUND`.
- Với các route có `:id`, `INVALID_ID` được kiểm tra **trước** khi kiểm tra quyền.

---

## GET `/users/me`

Lấy thông tin tài khoản cá nhân của người dùng đang đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập (mọi `role`).
- **Thành công `200`:** message `Lấy thông tin cá nhân thành công.`, `data` là đối tượng User của chính người gọi (id lấy từ token).
- **Lỗi thường gặp:**
  - `USER_NOT_FOUND` (404): Không còn bản ghi user ứng với `userId` trong token.

---

## PATCH `/users/me`

Cập nhật thông tin cá nhân của người dùng đang đăng nhập.

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Request Body:** Tất cả trường đều tùy chọn; chỉ trường nào có mặt trong body (khác `undefined`) mới được cập nhật.
  ```json
  {
    "name": "Nguyen Van A",
    "phone": "0900000000",
    "dateOfBirth": "2000-01-01",
    "gender": "MALE",
    "citizenId": "001200000000",
    "address": "Ha Noi",
    "emergencyContact": "0911111111"
  }
  ```

  | Trường | Kiểu | Quy tắc |
  | --- | --- | --- |
  | `name` | string | Lưu nguyên giá trị gửi lên (không trim, không kiểm tra rỗng). |
  | `phone` | string | Unique. Gửi `""` hoặc `null` để xóa (đặt `null`). Trùng số của tài khoản khác -> `PHONE_ALREADY_EXISTS`. Trùng số của chính mình thì hợp lệ. |
  | `dateOfBirth` | string ngày (`YYYY-MM-DD` hoặc ISO) | Chuyển bằng `new Date(...)`. Giá trị falsy (`null`, `""`) -> đặt `null`. Chuỗi không parse được -> `500`. |
  | `gender` | `MALE`/`FEMALE`/`OTHER` | Không validate ở API; sai enum -> `500`. |
  | `citizenId` | string | Được `trim()`. Unique. Chuỗi rỗng/chỉ khoảng trắng hoặc `null` -> đặt `null`. Trùng của tài khoản khác -> `CITIZEN_ID_ALREADY_EXISTS`. |
  | `address` | string | Lưu nguyên giá trị. |
  | `emergencyContact` | string | Lưu nguyên giá trị. |

  - Các trường khác (`email`, `role`, `status`, `avatarUrl`, `password`...) bị **bỏ qua**: người dùng không tự đổi được `role`/`status`/email qua API này.
- **Thành công `200`:** message `Cập nhật thông tin cá nhân thành công.`, `data` là đối tượng User sau khi cập nhật.
- **Lỗi thường gặp:**
  - `USER_NOT_FOUND` (404)
  - `PHONE_ALREADY_EXISTS` (409): Số điện thoại trùng với tài khoản khác.
  - `CITIZEN_ID_ALREADY_EXISTS` (409): CCCD/CMND trùng với tài khoản khác.
  - `500`: không gửi body JSON, hoặc giá trị sai kiểu/enum/độ dài.

---

## PATCH `/users/me/avatar`

Cập nhật ảnh đại diện của người dùng (tải lên thông qua Cloudinary).

- **Quyền hạn:** Mọi tài khoản đã đăng nhập.
- **Content-Type:** `multipart/form-data`
- **Field file:** `avatar` (đúng 1 file).
- **Quy tắc file (multer):**
  - Kích thước tối đa **5MB** (`5 * 1024 * 1024` byte).
  - Chỉ nhận file có `mimetype` bắt đầu bằng `image/`.
  - Dùng `memoryStorage` (buffer trong RAM, không ghi file tạm ra đĩa của server).
- **Lưu trữ:** Buffer được stream lên Cloudinary, thư mục `gym_avatars` (`resource_type: image`). `secure_url` (HTTPS) trả về từ Cloudinary được lưu vào `avatarUrl`. Code không xóa ảnh cũ trên Cloudinary.
- **Thành công `200`:** message `Cập nhật ảnh đại diện thành công.`, `data` là đối tượng User với `avatarUrl` mới.
- **Lỗi thường gặp:**
  - `BAD_REQUEST` (400): Không có file (thiếu field `avatar` hoặc request không phải `multipart/form-data`). Message: `Vui lòng chọn một file ảnh để tải lên.`
  - `USER_NOT_FOUND` (404)
  - `500`: upload Cloudinary thất bại.
  - Lỗi của multer (file > 5MB `LIMIT_FILE_SIZE`, sai loại file `Chỉ chấp nhận file ảnh!`, sai tên field `LIMIT_UNEXPECTED_FILE`) **không được controller bắt** và app không có error middleware, nên Express trả `500` theo định dạng mặc định (không phải JSON của API).

---

## GET `/users`

Ban quản trị xem danh sách toàn bộ người dùng trong hệ thống (có hỗ trợ tìm kiếm, lọc và phân trang).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - STAFF và ADMIN đều xem được toàn bộ người dùng trong hệ thống.
  - Các role khác (`USER`, `COACH`) nhận `401 UNAUTHORIZED` (service dùng mã `UNAUTHORIZED` chứ không phải `FORBIDDEN` cho endpoint này).
- **Query Parameters:**
  - `page` (optional): Trang hiện tại, mặc định `1`. Giá trị không parse được hoặc `< 1` được đưa về `1`.
  - `limit` (optional): Số bản ghi/trang, mặc định `10`, **tối đa `100`** (lớn hơn bị cắt về `100`, nhỏ hơn `1` được đưa về `1`; `0` hoặc không parse được -> dùng mặc định `10`).
  - `search` (optional): Tìm kiếm không phân biệt hoa/thường (`contains`) theo tên (`name`), email, số điện thoại (`phone`) **và CCCD (`citizenId`)**. Giá trị được `trim()`; chuỗi rỗng bị bỏ qua.
  - `role` (optional): Lọc theo vai trò (`ADMIN`, `STAFF`, `COACH`, `USER`). Giá trị sai enum -> `500`.
  - `status` (optional): Lọc theo trạng thái (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`, `DELETED`). Giá trị sai enum -> `500`.
- **Hành vi lọc mặc định:** Nếu **không** truyền `status`, các tài khoản đã xóa mềm (`status = DELETED`) bị **loại khỏi** kết quả. Muốn xem tài khoản đã xóa, truyền `status=DELETED`.
- **Sắp xếp:** `createdAt` giảm dần (mới nhất trước).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy danh sách người dùng thành công.",
    "data": [
      {
        "id": 1,
        "email": "user@example.com",
        "name": "Nguyen Van A",
        "phone": "0900000000",
        "dateOfBirth": "2000-01-01T00:00:00.000Z",
        "role": "USER",
        "status": "ACTIVE",
        "avatarUrl": null,
        "gender": "MALE",
        "citizenId": null,
        "address": null,
        "emergencyContact": null,
        "createdAt": "2026-06-01T00:00:00.000Z",
        "updatedAt": "2026-06-01T00:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
  ```
  - `totalPages = ceil(total / limit)`, bằng `0` khi không có bản ghi.
- **Lỗi thường gặp:**
  - `UNAUTHORIZED` (401): Role không phải `ADMIN`/`STAFF`.

---

## POST `/users`

Ban quản trị tạo trực tiếp tài khoản mới (ví dụ tạo tài khoản cho nhân viên mới, huấn luyện viên mới).

- **Quyền hạn:** `ADMIN`, `STAFF`.
  - **Ràng buộc an toàn:**
    - STAFF không thể tạo tài khoản có role `ADMIN` (trả lỗi `403 FORBIDDEN`). Kiểm tra này chạy trước các kiểm tra trùng lặp.
    - Các role khác (`USER`, `COACH`) -> `403 FORBIDDEN`.
- **Request Body:**
  ```json
  {
    "email": "staff@example.com",
    "password": "GymManager@123",
    "name": "Nguyen Van B",
    "phone": "0912345678",
    "role": "STAFF"
  }
  ```

  | Trường | Bắt buộc | Quy tắc |
  | --- | --- | --- |
  | `email` | Có | Được `trim()` và chuyển chữ thường trước khi lưu. Unique. Thiếu `email` -> `500` (không có validate). |
  | `name` | Có | Chuỗi. Thiếu -> `500`. |
  | `password` | Không | Mặc định `GymManager@123` (dùng `||`, nên chuỗi rỗng cũng dùng mặc định). Băm bằng bcrypt (cost 10). Không kiểm tra độ dài tối thiểu. |
  | `phone` | Không | Unique (kiểm tra khi khác `null`/`""`); rỗng -> lưu `null`. |
  | `dateOfBirth` | Không | Chuỗi ngày; rỗng -> `null`. |
  | `role` | Không | Mặc định `USER`. |
  | `status` | Không | Mặc định `ACTIVE`; có thể truyền bất kỳ giá trị `status` hợp lệ nào. |
  | `avatarUrl` | Không | Chuỗi URL (lưu nguyên, không upload). |
  | `gender` | Không | `MALE`/`FEMALE`/`OTHER`. |
  | `citizenId` | Không | Được `trim()`. Unique. |
  | `address` | Không | Chuỗi. |
  | `emergencyContact` | Không | Chuỗi. |

- **Hiệu ứng phụ:**
  - Nếu role của tài khoản mới là `COACH`: tạo thêm `CoachProfile` (`userId` = id mới, `isAvailable = true`). Thao tác này chạy sau khi tạo user và **không** nằm trong cùng transaction.
  - Gửi email chào mừng (chứa email, role và **mật khẩu tạm thời dạng văn bản thô**) tới địa chỉ email của tài khoản mới. Email gửi bất đồng bộ (không chờ), lỗi gửi chỉ được log ra console và không ảnh hưởng response. Email được gửi cho mọi role, kể cả `USER`.
- **Thành công `201`:** message `Tạo người dùng mới thành công.`, `data` là tài khoản User mới được tạo (không chứa mật khẩu).
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`, hoặc STAFF tạo tài khoản `ADMIN`.
  - `EMAIL_ALREADY_EXISTS` (409)
  - `PHONE_ALREADY_EXISTS` (409)
  - `CITIZEN_ID_ALREADY_EXISTS` (409)
  - `500`: thiếu `email`/`name`, không có body JSON, sai enum, quá độ dài cột.

---

## GET `/users/stats`

Lấy thống kê số lượng tài khoản theo từng nhóm vai trò và trạng thái (phục vụ biểu đồ quản trị).

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
- **Quy tắc tính:**
  - Toàn bộ số liệu **loại trừ** tài khoản `status = DELETED`. Vì vậy `byStatus` không có khóa `DELETED`.
  - `byRole`/`byStatus` luôn có đủ các khóa, khóa không có dữ liệu là `0`.
  - `newRegistrations.today`: số tài khoản có `createdAt` từ 00:00 hôm nay; `thisMonth`: từ ngày 1 của tháng hiện tại. Mốc thời gian tính theo múi giờ của server.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Lấy dữ liệu thống kê người dùng thành công.",
    "data": {
      "totalUsers": 100,
      "byRole": { "ADMIN": 1, "COACH": 5, "STAFF": 3, "USER": 91 },
      "byStatus": { "ACTIVE": 90, "INACTIVE": 5, "SUSPENDED": 3, "BANNED": 2 },
      "newRegistrations": { "today": 2, "thisMonth": 20 }
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403)

---

## GET `/users/:id`

Xem chi tiết thông tin một người dùng bất kỳ.

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
  - STAFF xem được cả tài khoản `ADMIN`.
- **Path Parameters:** `id` (số nguyên): ID người dùng.
- **Thành công `200`:** message `Lấy chi tiết người dùng thành công.`, `data` là đối tượng User. Endpoint này trả về cả tài khoản đã xóa mềm (`status = DELETED`).
- **Lỗi thường gặp:**
  - `INVALID_ID` (400)
  - `FORBIDDEN` (403)
  - `USER_NOT_FOUND` (404)

---

## PATCH `/users/:id`

Cập nhật thông tin của một người dùng bất kỳ.

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
  - **Ràng buộc bảo mật của STAFF:**
    - STAFF không thể chỉnh sửa thông tin tài khoản của `ADMIN` (trả lỗi `403 FORBIDDEN`).
    - STAFF không thể thay đổi/nâng cấp vai trò (`role`) của bất kỳ tài khoản nào lên thành `ADMIN` (trả lỗi `403 FORBIDDEN`).
  - `ADMIN` không bị giới hạn (kể cả đổi `role` của chính mình).
- **Path Parameters:** `id` (số nguyên): ID người dùng cần sửa.
- **Request Body:** Tất cả trường đều tùy chọn; chỉ trường có mặt (khác `undefined`) mới được cập nhật.
  ```json
  {
    "name": "Nguyen Van B",
    "phone": "0912345678",
    "dateOfBirth": "1999-05-20",
    "role": "COACH",
    "gender": "FEMALE",
    "citizenId": "001299999999",
    "address": "Ha Noi",
    "emergencyContact": "0911111111"
  }
  ```
  - Các trường và quy tắc (`name`, `phone`, `dateOfBirth`, `gender`, `citizenId`, `address`, `emergencyContact`) giống `PATCH /users/me`; kiểm tra trùng `phone`/`citizenId` bỏ qua chính tài khoản đang sửa.
  - `role` (`ADMIN`/`COACH`/`STAFF`/`USER`): không validate; sai enum -> `500`.
  - Các trường `email`, `status`, `avatarUrl`, `password` **không** được xử lý ở endpoint này (bị bỏ qua). Đổi trạng thái dùng `PATCH /users/:id/status`; đổi mật khẩu dùng `POST /users/:id/reset-password`.
- **Thứ tự kiểm tra:** quyền (`FORBIDDEN`) -> tồn tại user (`USER_NOT_FOUND`) -> STAFF sửa ADMIN (`FORBIDDEN`) -> STAFF gán `role = ADMIN` (`FORBIDDEN`) -> trùng `phone` -> trùng `citizenId`.
- **Hiệu ứng phụ:** Sau khi cập nhật, nếu `role` của user là `COACH` và chưa có `CoachProfile` thì tạo mới (`isAvailable = true`). Nếu đã có hồ sơ thì giữ nguyên. Đổi role khỏi `COACH` không xóa `CoachProfile`.
- **Thành công `200`:** message `Cập nhật thông tin người dùng thành công.`, `data` là đối tượng User sau cập nhật.
- **Lỗi thường gặp:**
  - `INVALID_ID` (400)
  - `FORBIDDEN` (403)
  - `USER_NOT_FOUND` (404)
  - `PHONE_ALREADY_EXISTS` (409)
  - `CITIZEN_ID_ALREADY_EXISTS` (409)
  - `500`: không có body JSON, sai kiểu/enum/độ dài.

---

## PATCH `/users/:id/status`

Thay đổi trạng thái hoạt động của một tài khoản.

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
  - STAFF không được thay đổi trạng thái của tài khoản `ADMIN` (`403 FORBIDDEN`).
  - Không có ràng buộc nào chặn người dùng tự đổi trạng thái của chính mình.
- **Path Parameters:** `id` (số nguyên): ID người dùng.
- **Request Body:**
  ```json
  {
    "status": "SUSPENDED"
  }
  ```
  - `status` (bắt buộc): một trong `ACTIVE`, `INACTIVE`, `SUSPENDED`, `BANNED`, `DELETED`. Không validate ở API; sai enum -> `500`. Truyền `DELETED` tương đương xóa mềm.
- **Thành công `200`:** message `Cập nhật trạng thái tài khoản thành công.`, `data` là đối tượng User sau cập nhật.
- **Lỗi thường gặp:**
  - `INVALID_ID` (400)
  - `FORBIDDEN` (403)
  - `USER_NOT_FOUND` (404)
  - `500`: không có body JSON hoặc `status` sai enum.

---

## DELETE `/users/:id`

Xóa mềm tài khoản người dùng khỏi hệ thống (thiết lập trạng thái `status = DELETED`).

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
  - STAFF không được xóa tài khoản của `ADMIN` (`403 FORBIDDEN`).
  - Không có ràng buộc nào chặn người dùng tự xóa mềm chính mình.
- **Path Parameters:** `id` (số nguyên): ID người dùng.
- **Request Body:** Không dùng (bị bỏ qua).
- **Hành vi:**
  - Thực chất là `PATCH /users/:id/status` với `status = DELETED` (cùng quy tắc quyền); không xóa bản ghi và không xóa dữ liệu liên quan (membership, check-in, ...).
  - Tài khoản `DELETED` bị ẩn khỏi `GET /users` (trừ khi lọc `status=DELETED`) và không được tính trong `GET /users/stats`, nhưng vẫn truy cập được qua `GET /users/:id`. Có thể khôi phục bằng `PATCH /users/:id/status`.
  - Xóa mềm tài khoản đã `DELETED` vẫn trả `200`.
- **Thành công `200`:** message `Xóa mềm tài khoản người dùng thành công.`, `data` là đối tượng User với `status = "DELETED"`.
- **Lỗi thường gặp:**
  - `INVALID_ID` (400)
  - `FORBIDDEN` (403)
  - `USER_NOT_FOUND` (404)

---

## POST `/users/:id/reset-password`

Đặt lại mật khẩu cho một tài khoản người dùng về mặc định hoặc một mật khẩu mới.

- **Quyền hạn:** `ADMIN`, `STAFF`. Role khác -> `403 FORBIDDEN`.
  - STAFF không được reset mật khẩu cho tài khoản `ADMIN` (`403 FORBIDDEN`).
- **Path Parameters:** `id` (số nguyên): ID người dùng.
- **Request Body:**
  ```json
  {
    "newPassword": "NewPassword@123"
  }
  ```
  - **Lưu ý:** Nếu không truyền mật khẩu mới `newPassword` (hoặc truyền chuỗi rỗng), hệ thống tự đặt mật khẩu mặc định là `GymManager@123`. Mật khẩu được băm bằng bcrypt (cost 10), không kiểm tra độ dài tối thiểu.
  - Endpoint vẫn cần body JSON (kể cả `{}`); không có body thì trả `500`.
- **Hiệu ứng phụ:** Chỉ cập nhật `passwordHash`. Code không gửi email thông báo và không thu hồi phiên/refresh token hiện có.
- **Thành công `200`:** message `Reset mật khẩu người dùng thành công.`, `data` là đối tượng User (không chứa mật khẩu, không trả lại mật khẩu mới).
- **Lỗi thường gặp:**
  - `INVALID_ID` (400)
  - `FORBIDDEN` (403)
  - `USER_NOT_FOUND` (404)
  - `500`: không có body JSON.
