# Coach API

Base path: `/coach`

Hai API đầu (`GET /coach`, `GET /coach/:id`) là public, không cần đăng nhập. Các API còn lại yêu cầu Bearer token (`authMiddleware`).

Danh sách route (8):

| Method | Path | Đăng nhập | Quyền |
| --- | --- | --- | --- |
| GET | `/coach` | Không | Công khai |
| GET | `/coach/:id` | Không | Công khai |
| GET | `/coach/profile/me` | Có | `COACH` |
| PUT | `/coach/profile` | Có | `COACH` |
| GET | `/coach/availability/me` | Có | `COACH` |
| PUT | `/coach/availability` | Có | `COACH` |
| GET | `/coach/admin/list` | Có | `ADMIN`, `STAFF` |
| PATCH | `/coach/admin/:id/status` | Có | Chỉ `ADMIN` |

Module này không dùng Redis và không phát event/thông báo.

---

## Kiểu dữ liệu chính

Coach profile lấy từ bảng `coach_profiles`, thường kèm user, lịch rảnh, packages tùy theo endpoint:

```json
{
  "id": 1,
  "userId": 2,
  "speciality": "Muscle Gain",
  "bio": "PT 5 năm kinh nghiệm",
  "isAvailable": true,
  "createdAt": "2026-06-01T00:00:00.000Z",
  "updatedAt": "2026-06-01T00:00:00.000Z"
}
```

`speciality` và `bio` có thể là `null` (hồ sơ mới tạo tự động chỉ có `userId` và `isAvailable = true`).

Lịch rảnh hàng tuần (`CoachAvailability`, bảng `coach_availabilities`):

```json
{
  "id": 1,
  "coachId": 1,
  "dayOfWeek": 1,
  "startTime": "18:00",
  "endTime": "20:00",
  "startMinutes": 1080,
  "endMinutes": 1200
}
```

- `dayOfWeek`: `0` = Chủ Nhật, `1` = Thứ 2, ..., `6` = Thứ 7.
- `startTime`/`endTime`: chuỗi `"HH:mm"`.
- `startMinutes`/`endMinutes`: số phút tính từ `00:00` (`18:00` = `1080`), dùng để lọc theo khung giờ.

Gói PT của coach (`CoachPtPackage`, chỉ có trong `GET /coach/:id`): giá riêng của PT cho từng gói combo mẫu. `price` là `Decimal` nên JSON là chuỗi.

```json
{
  "coachId": 1,
  "ptPackageId": 1,
  "price": "3000000",
  "isActive": true,
  "ptPackage": {
    "id": 1,
    "name": "Combo 20 buổi",
    "code": "PT_20",
    "numberOfSessions": 20,
    "durationDays": 60,
    "goal": "MUSCLE_GAIN",
    "isActive": true,
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-01T00:00:00.000Z"
  }
}
```

---

## Định dạng lỗi chung

- `401` (do `authMiddleware`, body **không** có `success`; chỉ áp dụng cho các route yêu cầu đăng nhập):
  - `{ "error": "Unauthorized" }`: thiếu header `Authorization` hoặc không có dạng `Bearer <token>`.
  - `{ "error": "Invalid token" }`: token sai hoặc hết hạn.
- Lỗi nghiệp vụ: `{ "success": false, "message": "<thông báo tiếng Việt>" }`. Response **không có** trường `error`/mã lỗi; các mã như `COACH_NOT_FOUND` là định danh nội bộ (giá trị `Error.message` do service ném ra) để tra cứu, client phân biệt bằng HTTP status và `message`.
- Lỗi không map được (kể cả lỗi validate của Prisma khi `id`/`page`/`limit` không phải số, `goal` không thuộc enum...) -> `500` `"Lỗi hệ thống. Vui lòng thử lại sau."`. Module này không có lớp validate query/body riêng.

Bảng mã lỗi trong `mapError` của controller:

| Mã nội bộ | HTTP | `message` trả về |
| --- | --- | --- |
| `COACH_NOT_FOUND` | 404 | Không tìm thấy hồ sơ huấn luyện viên. |
| `COACH_PROFILE_NOT_FOUND` | 404 | Tài khoản của bạn chưa có hồ sơ huấn luyện viên. |
| `MISSING_REQUIRED_FIELDS` | 400 | Vui lòng nhập đầy đủ các trường bắt buộc. |
| `FORBIDDEN` | 403 | Bạn không có quyền thực hiện chức năng này. |
| `COACH_PROFILE_ALREADY_EXISTS` | 400 | Hồ sơ của huấn luyện viên này đã tồn tại. (có trong `mapError` nhưng không route nào của module ném ra) |
| (mọi mã khác) | 500 | Lỗi hệ thống. Vui lòng thử lại sau. |

Hồ sơ coach (`CoachProfile`) không được tạo qua module này: nó được tạo tự động (`isAvailable = true`) khi ADMIN/STAFF tạo user có role `COACH` hoặc đổi role user sang `COACH` (module users).

---

## Quy tắc `isAvailable`

- Mặc định `true` khi hồ sơ được tạo.
- `GET /coach` chỉ trả các PT có `isAvailable = true`. `GET /coach/:id` và `GET /coach/admin/list` **không** lọc theo `isAvailable` (admin list có bộ lọc tùy chọn).
- PT **không** tự đổi được `isAvailable`: `PUT /coach/profile` chỉ nhận `speciality` và `bio`, mọi trường khác (kể cả `isAvailable`) bị bỏ qua.
- Người đổi `isAvailable` là `ADMIN` qua `PATCH /coach/admin/:id/status` (`STAFF` bị `403`). **Hiện trạng:** hàm cập nhật ở repository chỉ ghi `speciality` và `bio`, bỏ qua `isAvailable`, nên API này trả `200` nhưng giá trị `isAvailable` **không thay đổi** (xem endpoint bên dưới).
- Module `pt-booking` không kiểm tra `isAvailable` khi thuê PT/đổi PT (chỉ kiểm tra `CoachPtPackage`). Danh sách PT theo gói ở `GET /pt-package/:id/coaches` có lọc `isAvailable = true`.

---

## GET `/coach`

Lấy danh sách PT (Huấn luyện viên cá nhân) public đang mở hoạt động nhận khách (`isAvailable = true`).

- **Quyền hạn:** Không yêu cầu đăng nhập.
- **Query Parameters** (mọi tham số đều là chuỗi, tất cả optional):
  - `page`: Trang hiện tại, mặc định `1`.
  - `limit`: Số bản ghi/trang, mặc định `10`. Không có giới hạn tối đa.
  - `search`: Tìm kiếm theo **tên** của PT (`user.name` chứa chuỗi, không phân biệt hoa thường; không tìm theo email/số điện thoại).
  - `goal`: Lọc PT có ít nhất 1 gói PT (`CoachPtPackage`) thuộc mục tiêu này: `WEIGHT_LOSS`, `MUSCLE_GAIN`, `COMPETITION_PREP`, `REHABILITATION`, `GENERAL_FITNESS`. Không lọc theo `isActive` của gói. Giá trị ngoài enum -> `500`.
  - `ptPackageId`: Lọc các PT đang dạy gói Combo này (`CoachPtPackage.isActive = true`). Nếu truyền cả `goal` và `ptPackageId` thì **chỉ `ptPackageId` có hiệu lực** (điều kiện sau ghi đè điều kiện `goal`).
  - `dayOfWeek`, `startTime`, `endTime`: Lọc theo **một** khung giờ. Phải truyền đủ cả ba, thiếu một trong ba thì bị bỏ qua. `dayOfWeek`: `0` (Chủ Nhật) đến `6` (Thứ 7); `startTime`/`endTime`: `"HH:mm"`, ví dụ `18:00`, `20:00`.
  - `slots`: Lọc theo **nhiều** khung giờ, là chuỗi JSON của mảng, ví dụ `[{"dayOfWeek":1,"startTime":"18:00","endTime":"20:00"}]` (cần URL-encode). Nếu có `slots` thì `dayOfWeek`/`startTime`/`endTime` bị bỏ qua hoàn toàn, kể cả khi `slots` là mảng rỗng hoặc parse lỗi.
- **Quy tắc lọc theo lịch rảnh:**
  - Mỗi khung giờ được quy ra phút: `giờ * 60 + phút` (tách `startTime`/`endTime` theo `:`).
  - Một PT khớp một khung giờ khi có **ít nhất một** dòng `CoachAvailability` cùng `dayOfWeek` với `startMinutes <= phút bắt đầu yêu cầu` và `endMinutes >= phút kết thúc yêu cầu` (khoảng rảnh phải bao trọn khung giờ yêu cầu).
  - Với `slots` nhiều phần tử, PT phải khớp **tất cả** các khung giờ (điều kiện AND).
  - `slots` không phải JSON hợp lệ, hoặc phần tử thiếu `startTime`/`endTime`: lỗi được ghi log và **bỏ qua bộ lọc** (vẫn trả `200`, không báo lỗi). `dayOfWeek` không phải số, hoặc giờ không tách ra được số (ví dụ `"abc"`) -> `500`.
- **Phân trang:** `skip = (page - 1) * limit`. `page < 1` hoặc `page`/`limit` không phải số -> `500`. Danh sách không có `orderBy` (thứ tự do DB quyết định).
- **Thành công `200`:** `data` là mảng coach profile kèm `user` (`name`, `email`, `phone`, `avatarUrl`) và `availabilities` (toàn bộ lịch rảnh của PT, không chỉ khung giờ khớp). Không kèm `packages` (dùng `GET /coach/:id` để lấy gói và giá). `meta` là phân trang. Lưu ý `email` và `phone` của PT được trả công khai.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "userId": 2,
        "speciality": "Muscle Gain",
        "bio": "PT 5 năm kinh nghiệm",
        "isAvailable": true,
        "createdAt": "2026-06-01T00:00:00.000Z",
        "updatedAt": "2026-06-01T00:00:00.000Z",
        "user": {
          "name": "HLV Nguyễn Văn Hùng",
          "email": "hung@example.com",
          "phone": "0900000000",
          "avatarUrl": null
        },
        "availabilities": [
          {
            "id": 1,
            "coachId": 1,
            "dayOfWeek": 1,
            "startTime": "18:00",
            "endTime": "20:00",
            "startMinutes": 1080,
            "endMinutes": 1200
          }
        ]
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
- **Lỗi thường gặp:** `500` (tham số `page`/`limit`/`ptPackageId`/`dayOfWeek` không phải số, `page < 1`, `goal` không thuộc enum, lỗi hệ thống).

---

## GET `/coach/:id`

Lấy thông tin chi tiết của một PT theo `CoachProfile.id`.

- **Quyền hạn:** Không yêu cầu đăng nhập.
- **Path Param `id`:** `CoachProfile.id` (số). Không phải số -> `500`.
- **Lưu ý:** Không lọc theo `isAvailable`: PT đang bị khóa (`isAvailable = false`) vẫn xem được. `packages` gồm **tất cả** gói của PT, kể cả `isActive = false`.
- **Thành công `200`:** `data` là chi tiết coach profile kèm `user` (`name`, `email`, `phone`, `avatarUrl`), `availabilities` (toàn bộ lịch rảnh) và `packages` (các `CoachPtPackage`, mỗi phần tử kèm `ptPackage` là gói combo mẫu).
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "userId": 2,
      "speciality": "Muscle Gain",
      "bio": "PT 5 năm kinh nghiệm",
      "isAvailable": true,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-01T00:00:00.000Z",
      "user": {
        "name": "HLV Nguyễn Văn Hùng",
        "email": "hung@example.com",
        "phone": "0900000000",
        "avatarUrl": null
      },
      "availabilities": [
        {
          "id": 1,
          "coachId": 1,
          "dayOfWeek": 1,
          "startTime": "18:00",
          "endTime": "20:00",
          "startMinutes": 1080,
          "endMinutes": 1200
        }
      ],
      "packages": [
        {
          "coachId": 1,
          "ptPackageId": 1,
          "price": "3000000",
          "isActive": true,
          "ptPackage": {
            "id": 1,
            "name": "Combo 20 buổi",
            "code": "PT_20",
            "numberOfSessions": 20,
            "durationDays": 60,
            "goal": "MUSCLE_GAIN",
            "isActive": true,
            "createdAt": "2026-06-01T00:00:00.000Z",
            "updatedAt": "2026-06-01T00:00:00.000Z"
          }
        }
      ]
    }
  }
  ```
- **Lỗi thường gặp:**
  - `COACH_NOT_FOUND` (404): Không tìm thấy hồ sơ PT.
  - `500`: `id` không phải số hoặc lỗi hệ thống.

---

## GET `/coach/profile/me`

PT tự xem hồ sơ cá nhân của mình.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`. Role khác (kể cả `ADMIN`/`STAFF`) nhận `FORBIDDEN` 403.
- **Thành công `200`:** `data` là hồ sơ của coach đang đăng nhập kèm `user` (`name`, `phone`, `email`, `avatarUrl`). Không kèm `availabilities`/`packages`.
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "userId": 2,
      "speciality": "Muscle Gain",
      "bio": "PT 5 năm kinh nghiệm",
      "isAvailable": true,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-01T00:00:00.000Z",
      "user": {
        "name": "HLV Nguyễn Văn Hùng",
        "phone": "0900000000",
        "email": "hung@example.com",
        "avatarUrl": null
      }
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `COACH`.
  - `COACH_PROFILE_NOT_FOUND` (404): Tài khoản chưa có hồ sơ huấn luyện viên.
  - `401`: Chưa đăng nhập hoặc token không hợp lệ.

---

## PUT `/coach/profile`

PT cập nhật hồ sơ cá nhân của mình.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`. Role khác nhận `FORBIDDEN` 403.
- **Request Body** (cả hai optional, không có validate kiểu; kiểu không phải chuỗi sẽ bị Prisma từ chối -> `500`):
  - `speciality` (string): chuyên môn.
  - `bio` (string): giới thiệu.
  ```json
  {
    "speciality": "Muscle Gain",
    "bio": "PT 5 năm kinh nghiệm"
  }
  ```
- **Quy tắc:** Chỉ cập nhật trường nào **có mặt** trong body (khác `undefined`); các trường khác (`isAvailable`, `userId`...) bị bỏ qua để PT không tự đổi trạng thái. Body rỗng vẫn trả `200` với hồ sơ không đổi.
- **Thành công `200`:** `data` là hồ sơ coach sau khi cập nhật (bản ghi `CoachProfile` thuần, không kèm `user`).
  ```json
  {
    "success": true,
    "message": "Cập nhật hồ sơ thành công.",
    "data": {
      "id": 1,
      "userId": 2,
      "speciality": "Muscle Gain",
      "bio": "PT 5 năm kinh nghiệm",
      "isAvailable": true,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-20T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `COACH`.
  - `COACH_PROFILE_NOT_FOUND` (404): Tài khoản chưa có hồ sơ huấn luyện viên.
  - `401`; `500` (sai kiểu dữ liệu, lỗi hệ thống).

---

## GET `/coach/availability/me`

PT xem lịch rảnh hàng tuần của mình.

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`. Role khác (kể cả `ADMIN`/`STAFF`) nhận `FORBIDDEN` 403.
- **Thành công `200`:** `data` là mảng các dòng `CoachAvailability` của PT (không sắp xếp). Trả mảng rỗng `[]` nếu chưa cấu hình lịch **hoặc** tài khoản chưa có hồ sơ coach (không trả `404`).
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "coachId": 1,
        "dayOfWeek": 1,
        "startTime": "18:00",
        "endTime": "20:00",
        "startMinutes": 1080,
        "endMinutes": 1200
      }
    ]
  }
  ```
- **Lỗi thường gặp:** `FORBIDDEN` (403): Không phải `COACH`; `401`.

---

## PUT `/coach/availability`

PT cập nhật lịch rảnh hàng tuần của mình. Đây là thao tác **thay thế toàn bộ**: xóa hết lịch cũ của PT rồi tạo lại theo mảng gửi lên (trong 1 transaction).

- **Quyền hạn:** Đăng nhập dưới vai trò `COACH`. Role khác nhận `FORBIDDEN` 403.
- **Request Body:**
  - `availabilities` (array, bắt buộc): danh sách khung giờ rảnh.
    - `dayOfWeek` (number): `0` (Chủ Nhật) đến `6` (Thứ 7).
    - `startTime` (string): `"HH:mm"`.
    - `endTime` (string): `"HH:mm"`.
  ```json
  {
    "availabilities": [
      {
        "dayOfWeek": 1,
        "startTime": "18:00",
        "endTime": "20:00"
      }
    ]
  }
  ```
- **Quy tắc tính `startMinutes`/`endMinutes`:** tách `startTime`/`endTime` theo `:` rồi tính `giờ * 60 + phút` (ví dụ `18:00` -> `1080`, `20:00` -> `1200`). Giá trị phút này được lưu cùng `startTime`/`endTime` và dùng cho bộ lọc lịch rảnh ở `GET /coach`.
- **Validation:** Code **không kiểm tra** định dạng giờ, phạm vi `dayOfWeek`, `endTime > startTime`, hay các khung giờ chồng lấn nhau trong cùng ngày. Không có mã lỗi nào cho các trường hợp này.
- **Hiện trạng (lỗi trong code):** service tính giá trị kết thúc vào trường tên sai `endMinuties`, trong khi repository ghi `endMinutes` từ `av.endMinutes` (luôn `undefined`). Vì vậy `createMany` bị Prisma từ chối (`Argument endMinutes is missing`), transaction rollback (lịch cũ được giữ nguyên) và API trả `500` `"Lỗi hệ thống. Vui lòng thử lại sau."` với **mọi** request có mảng `availabilities` không rỗng. Chỉ trường hợp `availabilities: []` chạy được: xóa toàn bộ lịch rảnh và trả `200`.
- **Thành công `200`** (kể cả khi gửi mảng rỗng; không có `data`):
  ```json
  {
    "success": true,
    "message": "Cập nhật lịch làm việc rảnh thành công."
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `COACH`.
  - `COACH_PROFILE_NOT_FOUND` (404): Tài khoản chưa có hồ sơ huấn luyện viên.
  - `401`.
  - `500`: thiếu `availabilities` (không phải mảng), khung giờ sai định dạng, và mọi request có khung giờ hợp lệ do lỗi `endMinuties` nêu trên.

---

## GET `/coach/admin/list`

Ban quản trị xem danh sách toàn bộ PT trong hệ thống (bao gồm cả PT đang không hoạt động).

- **Quyền hạn:** `ADMIN`, `STAFF` (role khác nhận `FORBIDDEN` 403).
  - STAFF và ADMIN đều xem được tất cả các PT trên toàn hệ thống.
- **Query Parameters** (tất cả optional, chuỗi):
  - `page`: Trang hiện tại, mặc định `1`.
  - `limit`: Số bản ghi/trang, mặc định `10`. Không có giới hạn tối đa.
  - `search`: Tìm kiếm theo tên của PT (`user.name` chứa chuỗi, không phân biệt hoa thường).
  - `isAvailable`: Lọc theo trạng thái sẵn sàng nhận khách. Chỉ chuỗi `true` được hiểu là `true`; mọi giá trị khác đã truyền (`false`, rỗng, `1`...) đều được hiểu là `false`. Không truyền thì không lọc.
  - `page`/`limit` không phải số hoặc `page < 1` -> `500`. Danh sách không có `orderBy`.
- **Thành công `200`:** `data` là mảng danh sách PT (coach profile kèm `user` gồm `name`, `email`, `phone`, `avatarUrl` và `availabilities`; không kèm `packages`), `meta` là phân trang.
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "userId": 2,
        "speciality": "Muscle Gain",
        "bio": "PT 5 năm kinh nghiệm",
        "isAvailable": false,
        "createdAt": "2026-06-01T00:00:00.000Z",
        "updatedAt": "2026-06-01T00:00:00.000Z",
        "user": {
          "name": "HLV Nguyễn Văn Hùng",
          "email": "hung@example.com",
          "phone": "0900000000",
          "avatarUrl": null
        },
        "availabilities": []
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```
- **Lỗi thường gặp:**
  - `FORBIDDEN` (403): Không phải `ADMIN`/`STAFF`.
  - `401`; `500` (tham số phân trang không hợp lệ, lỗi hệ thống).

---

## PATCH `/coach/admin/:id/status`

Admin thay đổi trạng thái hoạt động/nhận khách (`isAvailable`) của PT.

- **Quyền hạn:** Chỉ `ADMIN`. `STAFF` và các role khác nhận `FORBIDDEN` 403.
- **Path Param `id`:** `CoachProfile.id` cần cập nhật (số). Không phải số -> `500`.
- **Request Body:**
  - `isAvailable` (boolean, bắt buộc): thiếu (`undefined`) -> `MISSING_REQUIRED_FIELDS` 400. Kiểu dữ liệu không được kiểm tra thêm.
  ```json
  {
    "isAvailable": true
  }
  ```
- **Thứ tự kiểm tra:** (1) thiếu `isAvailable` -> `400` (kiểm tra ở controller, trước cả kiểm tra role, nên `STAFF` gửi body thiếu nhận `400` chứ không phải `403`); (2) role khác `ADMIN` -> `403`; (3) không tìm thấy PT -> `404`.
- **Hiện trạng (lỗi trong code):** hàm `updateProfile` ở repository chỉ ghi `speciality` và `bio`, không ghi `isAvailable`. Do đó API luôn trả `200` với thông báo thành công, nhưng `isAvailable` **không được cập nhật** trong DB và `data` là hồ sơ với giá trị cũ.
- **Thành công `200`:** `data` là coach profile (bản ghi thuần, không kèm `user`).
  ```json
  {
    "success": true,
    "message": "Cập nhật trạng thái PT thành công.",
    "data": {
      "id": 1,
      "userId": 2,
      "speciality": "Muscle Gain",
      "bio": "PT 5 năm kinh nghiệm",
      "isAvailable": true,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-20T00:00:00.000Z"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `MISSING_REQUIRED_FIELDS` (400): Thiếu `isAvailable` trong body.
  - `FORBIDDEN` (403): Không phải `ADMIN`.
  - `COACH_NOT_FOUND` (404): Không tìm thấy hồ sơ PT.
  - `401`; `500` (`id` không phải số, lỗi hệ thống).
