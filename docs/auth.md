# Auth API

Base path: `/auth`

## Tổng quan

Module xác thực tài khoản: đăng ký local bằng OTP email, đăng nhập, refresh token, logout, đổi mật khẩu, quên mật khẩu (OTP + reset token) và đăng nhập Google OAuth 2.0.

Toàn bộ 11 route của module (mount tại `src/app.ts` dưới `/auth`):

| Method | Path | Auth | Mô tả |
| --- | --- | --- | --- |
| POST | `/auth/register` | Không | Đăng ký, gửi OTP tới email, trả `registerToken` |
| POST | `/auth/verify-register` | Không | Xác thực OTP, tạo tài khoản |
| POST | `/auth/login` | Không | Đăng nhập email/password |
| POST | `/auth/refresh-access-token` | Không | Cấp lại access token từ refresh token |
| POST | `/auth/logout` | Không (token nằm trong body) | Hủy 1 refresh token |
| POST | `/auth/change-password` | Bearer token | Đổi mật khẩu |
| POST | `/auth/request-forgot-password-otp` | Không | Gửi OTP quên mật khẩu |
| POST | `/auth/verify-forgot-password-otp` | Không | Xác thực OTP, nhận `resetPasswordToken` |
| POST | `/auth/reset-password` | Không (dùng `resetPasswordToken`) | Đặt lại mật khẩu |
| GET | `/auth/google` | Không | Bắt đầu Google OAuth (redirect) |
| GET | `/auth/google/callback` | Không | Callback Google OAuth (redirect về frontend) |

---

## Quy ước chung

### Không có validate body

Module không dùng schema validation (zod/joi/...). Controller chuyển thẳng `req.body` vào service. Nếu thiếu field bắt buộc (ví dụ `email` là `undefined` nên `dto.email.trim()` ném `TypeError`), lỗi bị coi là exception không có mã và trả `500` (xem mục dưới). Riêng `change-password` và `reset-password` có kiểm tra thiếu field và trả `MISSING_REQUIRED_FIELDS`. Không có quy tắc độ mạnh mật khẩu, định dạng email hay định dạng số điện thoại.

### Định dạng lỗi (các route trả JSON)

Mọi lỗi do service ném ra (`throw new Error("<CODE>")`) được controller trả về theo dạng:

```json
{
  "success": false,
  "message": "Mật khẩu mới và xác nhận mật khẩu không khớp nhau.",
  "error": "PASSWORD_MISMATCH"
}
```

- `error` là mã lỗi (giá trị `error.message` của exception).
- Mã lỗi có trong `mapErrorStatus` được trả kèm HTTP status tương ứng (bảng bên dưới). Mã không có trong `mapErrorStatus` luôn trả `500`.
- `message` lấy từ `mapErrorMessage`. Mã không có trong `mapErrorMessage` nhận message mặc định `"Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau."`.
- Với lỗi không có mã (exception hệ thống: JWT lib, Prisma, SMTP, `TypeError`...), `error` là nguyên văn `error.message` của exception (ví dụ `jwt expired`, `invalid signature`, `jwt malformed`, `jwt must be provided`), HTTP `500`.

### Bảng mã lỗi mà controller map

| Mã lỗi | HTTP | Message |
| --- | --- | --- |
| `EMAIL_ALREADY_EXISTS` | `409` | Email này đã được sử dụng bởi một tài khoản khác. |
| `OTP_INVALID_OR_EXPIRED` | `400` | Mã OTP không chính xác hoặc đã hết hạn. |
| `INVALID_REGISTER_TOKEN` | `400` | Token đăng ký không hợp lệ. |
| `TOKEN_EMAIL_MISMATCH` | `400` | Token đăng ký không khớp với email cung cấp. |
| `REGISTER_TOKEN_EXPIRED` | `400` | Token đăng ký đã hết hạn. |
| `PASSWORD_MISMATCH` | `400` | Mật khẩu mới và xác nhận mật khẩu không khớp nhau. |
| `MISSING_REQUIRED_FIELDS` | `400` | Vui lòng điền đầy đủ các thông tin bắt buộc. |
| `INVALID_CREDENTIALS` | `401` | Email hoặc mật khẩu không chính xác. |
| `UNAUTHORIZED` | `401` | Bạn chưa đăng nhập hoặc token đã hết hạn. |
| `FORBIDDEN` | `403` | Bạn không có quyền thực hiện thao tác này. |
| `USER_NOT_FOUND` | `404` | Không tìm thấy người dùng này trong hệ thống. |
| `LOGIN_LOCKED` | `429` | Tài khoản của bạn đã bị khóa tạm thời trong 15 phút do nhập sai mật khẩu quá 5 lần. |
| `OTP_LIMIT_EXCEEDED` | `429` | Bạn đã yêu cầu gửi mã OTP quá giới hạn (tối đa 3 lần trong 15 phút). Vui lòng thử lại sau. |

Các mã sau service có ném nhưng controller **chưa map status**, nên hiện trả `500`:

| Mã lỗi | HTTP thực tế | `message` thực tế | Nơi phát sinh |
| --- | --- | --- | --- |
| `PHONE_ALREADY_EXISTS` | `500` | Message mặc định ("Đã xảy ra lỗi hệ thống...") | `/auth/register` |
| `INVALID_OLD_PASSWORD` | `500` | `Mật khẩu cũ không chính xác.` (có message riêng nhưng status vẫn `500`) | `/auth/change-password` |
| `INVALID_REFRESH_TOKEN` | `500` | Message mặc định | `/auth/refresh-access-token`, `/auth/logout` |
| `INVALID_REFRESH_TOKEN_PAYLOAD` | `500` | Message mặc định | `/auth/refresh-access-token`, `/auth/logout` |
| `INVALID_RESET_PASSWORD_TOKEN` | `500` | Message mặc định | `/auth/reset-password` |

### Lỗi xác thực Bearer token (`authMiddleware`)

Áp dụng cho `/auth/change-password` (và mọi module khác dùng `authMiddleware`). Header bắt buộc: `Authorization: Bearer <accessToken>`. Middleware chỉ kiểm tra chữ ký và hạn của JWT access token, không tra Redis hay database. Hai lỗi dưới đây **không** theo định dạng `success/message/error` ở trên:

| Điều kiện | HTTP | Body |
| --- | --- | --- |
| Thiếu header, header không bắt đầu bằng `Bearer `, hoặc phần token rỗng | `401` | `{ "error": "Unauthorized" }` |
| Token sai chữ ký, hết hạn hoặc payload thiếu `userId` (number) / `role` (string) | `401` | `{ "error": "Invalid token" }` |

Khi hợp lệ, middleware gán `req.user = { userId, role }`.

### Token

| Token | Ký bằng | Payload | Hạn |
| --- | --- | --- | --- |
| Access token (JWT) | `JWT_ACCESS_SECRET` | `{ "userId": 1, "role": "USER", "iat": ..., "exp": ... }` | `JWT_ACCESS_EXPIRES_IN`, mặc định `15m` |
| Refresh token (JWT) | `JWT_REFRESH_SECRET` | `{ "userId": 1, "tokenId": "<uuid v4>", "iat": ..., "exp": ... }` | `JWT_REFRESH_EXPIRES_IN`, mặc định `7d` |
| Register token (chuỗi tự ký) | HMAC-SHA256 bằng `REGISTER_TOKEN_SECRET` | Xem `/auth/register` | 15 phút |
| Reset password token (JWT) | `RESET_PASSWORD_TOKEN_SECRET` | `{ "email": "...", "purpose": "RESET_PASSWORD", "iat": ..., "exp": ... }` | 5 phút (hard-code `"5m"`) |

`role` trong access token là một trong `ADMIN`, `COACH`, `STAFF`, `USER`. Role được đọc từ database tại thời điểm login hoặc refresh.

### Redis keys

Mọi key có tiền tố `REDIS_KEY_PREFIX` (mặc định `hipu-hrm:dev:`) và ghép bằng dấu `:`. `<email>` luôn là email đã `trim().toLowerCase()`, trừ ghi chú ở `/auth/request-forgot-password-otp`.

| Key | Giá trị | TTL | Ý nghĩa |
| --- | --- | --- | --- |
| `otp:code:REGISTER:<email>` | OTP 6 chữ số dạng string | 600s (10 phút) | OTP đăng ký. Gọi `register` lần nữa sẽ ghi đè OTP cũ |
| `otp:code:FORGOT_PASSWORD:<email>` | OTP 6 chữ số | 600s (10 phút) | OTP quên mật khẩu, ghi đè khi gửi lại |
| `otp:limit:REGISTER:<email>` | Bộ đếm số lần gửi OTP | 900s (15 phút) | Tối đa 3 lần gửi OTP đăng ký / 15 phút |
| `otp:limit:FORGOT_PASSWORD:<email>` | Bộ đếm | 900s (15 phút) | Tối đa 3 lần gửi OTP quên mật khẩu / 15 phút |
| `login:attempts:<email>` | Bộ đếm lần đăng nhập sai | 900s (15 phút) | Khóa đăng nhập sau 5 lần sai |
| `refresh_token:<userId>:<tokenId>` | Hash bcrypt (cost 10) của refresh token | 604800s (7 ngày, hard-code) | Phiên đăng nhập. Mỗi lần login/Google login tạo 1 key mới, nên một user có thể có nhiều phiên song song |

Cách đếm dùng `incrWithExpire`: TTL chỉ được đặt ở lần `INCR` đầu tiên (cửa sổ cố định 15 phút tính từ lần đầu, không tự gia hạn khi đếm thêm). Khi kiểm tra vượt giới hạn, request bị từ chối và bộ đếm không tăng thêm.

Nếu `REDIS_ENABLED=false`: `get` luôn trả `null`, `set` không lưu gì, bộ đếm không hoạt động (không khóa, không giới hạn OTP), OTP không bao giờ xác thực được và refresh token không bao giờ hợp lệ. `change-password` và `reset-password` sẽ cập nhật mật khẩu rồi lỗi `500` (`Redis is disabled`) ở bước thu hồi token.

### Biến môi trường liên quan

| Biến | Dùng cho |
| --- | --- |
| `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN` (mặc định `15m`) | Access token |
| `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` (mặc định `7d`) | Refresh token (TTL Redis luôn là 7 ngày bất kể biến này) |
| `REGISTER_TOKEN_SECRET` | Register token |
| `RESET_PASSWORD_TOKEN_SECRET` | Reset password token (biến `RESET_PASSWORD_TOKEN_EXPIRES_IN` trong `.env` không được code đọc) |
| `SMTP_HOST` (mặc định `smtp.gmail.com`), `SMTP_PORT` (mặc định `465`), `SMTP_USER`, `SMTP_PASS` hoặc `SMTP_PASSWORD`, `MAIL_FROM` (mặc định = `SMTP_USER`) | Gửi email OTP |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (hoặc tên cũ `GOOGLE_REDIRECT_URI`) | Google OAuth |
| `FRONTEND_OAUTH_SUCCESS_URL`, `FRONTEND_OAUTH_ERROR_URL` | URL frontend nhận kết quả Google OAuth |
| `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_KEY_PREFIX` | Redis |

---

## POST `/auth/register`

Đăng ký tài khoản local. API chưa tạo tài khoản: chỉ kiểm tra email/phone, gửi OTP tới email và trả `registerToken` chứa thông tin đăng ký chờ xác thực. Tài khoản chỉ được tạo ở `/auth/verify-register`.

- **Quyền hạn:** Không cần đăng nhập.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password",
    "name": "Nguyen Van A",
    "phone": "0900000000",
    "dateOfBirth": "2000-01-01"
  }
  ```
  - `email` (string, bắt buộc): được `trim()` và chuyển chữ thường trước khi xử lý.
  - `password` (string, bắt buộc): băm bằng bcrypt (cost 10), không có quy tắc độ mạnh.
  - `name` (string, bắt buộc).
  - `phone` (string, bắt buộc): dùng nguyên văn (không trim), phải chưa được tài khoản nào dùng.
  - `dateOfBirth` (string, bắt buộc): chuỗi mà `new Date(...)` đọc được (khuyến nghị `YYYY-MM-DD`). Giá trị không hợp lệ gây exception `500` (`Invalid time value`); giá trị này được parse sau bước gửi mail nên OTP vẫn đã được gửi và lượt gửi vẫn bị tính.
- **Luồng xử lý:**
  1. Email đã tồn tại (kể cả tài khoản Google) thì `EMAIL_ALREADY_EXISTS`; phone đã tồn tại thì `PHONE_ALREADY_EXISTS`.
  2. Kiểm tra `otp:limit:REGISTER:<email>`: nếu đã `>= 3` thì `OTP_LIMIT_EXCEEDED`.
  3. Sinh OTP 6 chữ số (100000 đến 999999), lưu vào `otp:code:REGISTER:<email>` (TTL 10 phút, ghi đè OTP cũ), tăng bộ đếm `otp:limit:REGISTER:<email>` (TTL 15 phút), rồi gửi email (tiêu đề "Mã xác thực đăng ký") qua SMTP. Bộ đếm và OTP đã được ghi trước khi gửi mail, nên nếu gửi mail lỗi (ví dụ `SMTP_USER_AND_PASS_REQUIRED`, `MAIL_FROM_OR_SMTP_USER_REQUIRED`) thì trả `500` nhưng lượt gửi vẫn bị tính.
  4. Tạo `registerToken`.
- **Cấu trúc `registerToken`:** chuỗi `<payloadBase64url>.<signatureBase64url>`. Payload (JSON, chỉ ký không mã hóa):
  ```json
  {
    "email": "user@example.com",
    "passwordHash": "<bcrypt-hash>",
    "name": "Nguyen Van A",
    "phone": "0900000000",
    "dateOfBirth": "2000-01-01T00:00:00.000Z",
    "type": "REGISTER_PENDING",
    "exp": 1750000000000
  }
  ```
  `exp` là epoch mili-giây (thời điểm tạo + 15 phút).
- **Thành công `201`:**
  ```json
  {
    "success": true,
    "message": "Mã OTP đã được gửi tới email của bạn, vui lòng kiểm tra email và xác thực.",
    "data": {
      "email": "user@example.com",
      "registerToken": "<registerToken>"
    }
  }
  ```
  `data.email` là email đã chuẩn hóa (chữ thường).
- **Lỗi thường gặp:**
  - `EMAIL_ALREADY_EXISTS` (409)
  - `PHONE_ALREADY_EXISTS` (hiện trả `500`, xem bảng "chưa map status")
  - `OTP_LIMIT_EXCEEDED` (429): đã gửi 3 lần trong cửa sổ 15 phút.
  - `500`: thiếu field, `dateOfBirth` sai định dạng, gửi SMTP lỗi.

---

## POST `/auth/verify-register`

Xác thực OTP đăng ký và tạo tài khoản.

- **Quyền hạn:** Không cần đăng nhập.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "registerToken": "<registerToken>",
    "otpCode": "123456"
  }
  ```
  - `email` (string): được `trim()` và chuyển chữ thường, phải khớp email trong `registerToken`.
  - `registerToken` (string): token nhận được từ `/auth/register`.
  - `otpCode` (string, hoặc số): được chuyển thành string và `trim()` trước khi so sánh.
- **Thứ tự kiểm tra:**
  1. Token phải có dạng `payload.signature` và chữ ký HMAC khớp, sai thì `INVALID_REGISTER_TOKEN`.
  2. `payload.type === "REGISTER_PENDING"` và chưa quá `exp`, sai thì `REGISTER_TOKEN_EXPIRED`.
  3. `payload.email` khác `email` gửi lên thì `TOKEN_EMAIL_MISMATCH`.
  4. OTP trong Redis (`otp:code:REGISTER:<email>`) không tồn tại hoặc khác `otpCode` thì `OTP_INVALID_OR_EXPIRED`.
  5. Trong 1 transaction Prisma: kiểm tra lại email chưa tồn tại (nếu đã có thì `EMAIL_ALREADY_EXISTS`), tạo user.
- **Tài khoản được tạo với:** `role = USER`, `status = ACTIVE`, `emailVerifiedAt = thời điểm hiện tại`, các trường `email`, `passwordHash`, `name`, `phone`, `dateOfBirth` lấy từ `registerToken`.
- **Side effect:** sau khi tạo user, xóa `otp:code:REGISTER:<email>` và `otp:limit:REGISTER:<email>` khỏi Redis (OTP dùng một lần). API không trả token đăng nhập, client phải gọi `/auth/login`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Xác thực đăng ký tài khoản thành công.",
    "data": {
      "id": 1,
      "email": "user@example.com"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `INVALID_REGISTER_TOKEN` (400), `REGISTER_TOKEN_EXPIRED` (400), `TOKEN_EMAIL_MISMATCH` (400), `OTP_INVALID_OR_EXPIRED` (400)
  - `EMAIL_ALREADY_EXISTS` (409)
  - `500`: thiếu `registerToken`/`email`; hoặc lỗi unique của database (ví dụ số điện thoại đã bị tài khoản khác chiếm giữa lúc `register` và `verify-register`, vì phone chỉ được kiểm tra ở `register`).
- **Ghi chú:** không có giới hạn số lần nhập sai OTP ở API này.

---

## POST `/auth/login`

Đăng nhập bằng email và mật khẩu.

- **Quyền hạn:** Không cần đăng nhập.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "password"
  }
  ```
  - `email` (string, bắt buộc): được `trim()` và chuyển chữ thường.
  - `password` (string, bắt buộc).
- **Quy tắc khóa đăng nhập (Redis `login:attempts:<email>`):**
  - Bắt đầu mỗi request, nếu bộ đếm `>= 5` thì trả `LOGIN_LOCKED` (kể cả khi mật khẩu đúng). Nghĩa là 5 lần sai được phép, lần thứ 6 bị khóa.
  - Mỗi lần thất bại làm bộ đếm tăng 1: email không tồn tại, tài khoản không có mật khẩu (tài khoản Google-only) hoặc sai mật khẩu. Tất cả đều trả `INVALID_CREDENTIALS` (không phân biệt các trường hợp).
  - TTL 15 phút được đặt ở lần sai đầu tiên và không gia hạn. Lượt bị khóa không làm tăng bộ đếm. Khóa tự hết khi key hết hạn.
  - Đăng nhập thành công xóa bộ đếm.
- **Side effect:** sinh `tokenId` (UUID v4), lưu hash bcrypt của refresh token vào Redis `refresh_token:<userId>:<tokenId>` (TTL 7 ngày). Mỗi lần login là một phiên riêng, không thu hồi phiên cũ.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Đăng nhập thành công.",
    "data": {
      "accessToken": "<jwt>",
      "refreshToken": "<jwt>"
    }
  }
  ```
  Cấu trúc token xem mục "Token".
- **Lỗi thường gặp:**
  - `INVALID_CREDENTIALS` (401)
  - `LOGIN_LOCKED` (429)
  - `500`: thiếu `email`, hoặc thiếu `password` khi email tồn tại (exception, không tăng bộ đếm). Thiếu `password` với email không tồn tại vẫn trả `INVALID_CREDENTIALS` và tăng bộ đếm.
- **Ghi chú:** API không kiểm tra `status` của user (`INACTIVE`, `SUSPENDED`, `BANNED`, `DELETED` vẫn đăng nhập được nếu đúng mật khẩu).

---

## POST `/auth/refresh-access-token`

Cấp lại access token từ refresh token. Không xoay vòng refresh token: refresh token cũ vẫn dùng tiếp được đến khi hết hạn hoặc bị thu hồi.

- **Quyền hạn:** Không cần đăng nhập (dùng refresh token trong body).
- **Request Body:**
  ```json
  {
    "refreshToken": "<refreshToken>"
  }
  ```
- **Luồng xử lý:**
  1. Verify JWT bằng `JWT_REFRESH_SECRET`, payload phải có `userId` (number) và `tokenId` (string).
  2. Tìm `refresh_token:<userId>:<tokenId>` trong Redis và so khớp (`bcrypt.compare`) với refresh token gửi lên.
  3. Đọc `role` mới nhất của user từ database, ký access token mới.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Làm mới access token thành công.",
    "data": {
      "accessToken": "<jwt>"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `USER_NOT_FOUND` (404): user đã bị xóa khỏi database.
  - `INVALID_REFRESH_TOKEN` (hiện `500`): không có key trong Redis (đã logout, đã hết TTL, đã bị thu hồi khi đổi/reset mật khẩu) hoặc hash không khớp.
  - `INVALID_REFRESH_TOKEN_PAYLOAD` (hiện `500`): JWT hợp lệ nhưng payload thiếu `userId`/`tokenId`.
  - Lỗi từ thư viện JWT (hiện `500`, `error` là message gốc): `jwt expired`, `invalid signature`, `jwt malformed`, `invalid token`, `jwt must be provided` (thiếu `refreshToken` trong body).
- **Ghi chú:** không kiểm tra `status` của user.

---

## POST `/auth/logout`

Hủy phiên hiện tại bằng cách xóa refresh token khỏi Redis. Chỉ xóa đúng phiên của refresh token gửi lên (các phiên khác của user không bị ảnh hưởng). Access token đã cấp vẫn dùng được đến khi hết hạn.

- **Quyền hạn:** Không cần Bearer token (dùng refresh token trong body).
- **Request Body:**
  ```json
  {
    "refreshToken": "<refreshToken>"
  }
  ```
- **Luồng xử lý:** verify JWT và so khớp hash trong Redis như `/auth/refresh-access-token`, sau đó `DEL refresh_token:<userId>:<tokenId>`.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Đăng xuất thành công.",
    "data": null
  }
  ```
- **Lỗi thường gặp (đều trả `500` hiện tại):**
  - `INVALID_REFRESH_TOKEN`: token không còn trong Redis (kể cả gọi logout lần thứ hai với cùng token) hoặc hash không khớp.
  - `INVALID_REFRESH_TOKEN_PAYLOAD`.
  - Lỗi từ thư viện JWT, ví dụ `jwt expired`, `invalid signature`, `jwt must be provided`.

---

## POST `/auth/change-password`

Đổi mật khẩu của user đang đăng nhập.

- **Quyền hạn:** Cần Bearer token (mọi role: `ADMIN`, `COACH`, `STAFF`, `USER`).
- **Request Body:**
  ```json
  {
    "oldPassword": "old-password",
    "newPassword": "new-password",
    "confirmNewPassword": "new-password"
  }
  ```
  Cả 3 field đều bắt buộc. Không có quy tắc độ mạnh và không kiểm tra `newPassword` khác `oldPassword`.
- **Thứ tự kiểm tra:**
  1. Thiếu 1 trong 3 field thì `MISSING_REQUIRED_FIELDS`.
  2. `newPassword !== confirmNewPassword` thì `PASSWORD_MISMATCH`.
  3. User không tồn tại, hoặc user không có mật khẩu (tài khoản Google-only) thì `USER_NOT_FOUND`.
  4. `oldPassword` sai thì `INVALID_OLD_PASSWORD`.
- **Side effect:** cập nhật `passwordHash` (bcrypt cost 10) và thu hồi **toàn bộ** refresh token của user (quét Redis bằng `SCAN` với pattern `refresh_token:<userId>:*` rồi `DEL`), bao gồm phiên hiện tại. Client phải đăng nhập lại để có refresh token mới. Access token đang có vẫn dùng được đến khi hết hạn.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Đổi mật khẩu thành công.",
    "data": null
  }
  ```
- **Lỗi thường gặp:**
  - `401` `{ "error": "Unauthorized" }` / `{ "error": "Invalid token" }`: từ `authMiddleware`, xem mục "Lỗi xác thực Bearer token".
  - `UNAUTHORIZED` (401): controller dự phòng khi `req.user.userId` rỗng.
  - `MISSING_REQUIRED_FIELDS` (400), `PASSWORD_MISMATCH` (400)
  - `USER_NOT_FOUND` (404)
  - `INVALID_OLD_PASSWORD` (hiện trả `500` với message `Mật khẩu cũ không chính xác.`)

---

## POST `/auth/request-forgot-password-otp`

Gửi OTP quên mật khẩu tới email.

- **Quyền hạn:** Không cần đăng nhập.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```
  `email` (string, bắt buộc). Lưu ý: API này **không** `trim()`/chuyển chữ thường; email được tra cứu và dùng làm key Redis đúng nguyên văn. Email đăng ký luôn được lưu chữ thường nên cần gửi chữ thường.
- **Luồng xử lý:**
  1. Không tìm thấy user theo email thì trả thành công im lặng (cùng response `200`, không gửi OTP, không tính giới hạn) để tránh lộ thông tin.
  2. Kiểm tra `otp:limit:FORGOT_PASSWORD:<email>`: đã `>= 3` thì `OTP_LIMIT_EXCEEDED`.
  3. Sinh OTP 6 chữ số, lưu `otp:code:FORGOT_PASSWORD:<email>` (TTL 10 phút, ghi đè OTP cũ), tăng bộ đếm (TTL 15 phút), gửi email (tiêu đề "Mã xác thực quên mật khẩu").
- **Ghi chú:** tài khoản Google-only (không có mật khẩu) vẫn nhận được OTP và có thể đặt mật khẩu qua luồng này.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Mã OTP đã được gửi tới email của bạn, vui lòng kiểm tra email và xác thực.",
    "data": null
  }
  ```
- **Lỗi thường gặp:**
  - `OTP_LIMIT_EXCEEDED` (429): chỉ phát sinh với email thuộc user có thật.
  - `500`: thiếu `email`, gửi SMTP lỗi.

---

## POST `/auth/verify-forgot-password-otp`

Xác thực OTP quên mật khẩu và nhận `resetPasswordToken`.

- **Quyền hạn:** Không cần đăng nhập.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otpCode": "123456"
  }
  ```
  - `email` (string): được `trim()` và chuyển chữ thường.
  - `otpCode` (string, hoặc số): được chuyển thành string và `trim()`.
- **Luồng xử lý:** so sánh với `otp:code:FORGOT_PASSWORD:<email>` trong Redis; sai hoặc hết hạn thì `OTP_INVALID_OR_EXPIRED`. Đúng thì xóa OTP và bộ đếm `otp:limit:FORGOT_PASSWORD:<email>` (OTP dùng một lần), rồi ký `resetPasswordToken` (JWT, payload `{ email, purpose: "RESET_PASSWORD" }`, hạn 5 phút).
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Xác thực mã OTP thành công. Vui lòng dùng token này để thay đổi mật khẩu.",
    "data": {
      "resetPasswordToken": "<resetPasswordToken>"
    }
  }
  ```
- **Lỗi thường gặp:**
  - `OTP_INVALID_OR_EXPIRED` (400)
  - `500`: thiếu `email` hoặc `otpCode`.
- **Ghi chú:** không có giới hạn số lần nhập sai OTP ở API này.

---

## POST `/auth/reset-password`

Đặt lại mật khẩu bằng `resetPasswordToken`.

- **Quyền hạn:** Không cần đăng nhập (xác thực bằng `resetPasswordToken`).
- **Request Body:**
  ```json
  {
    "resetPasswordToken": "<resetPasswordToken>",
    "newPassword": "new-password",
    "confirmNewPassword": "new-password"
  }
  ```
  Cả 3 field đều bắt buộc.
- **Thứ tự kiểm tra:**
  1. Thiếu field thì `MISSING_REQUIRED_FIELDS`.
  2. `newPassword !== confirmNewPassword` thì `PASSWORD_MISMATCH`.
  3. Verify JWT bằng `RESET_PASSWORD_TOKEN_SECRET` (sai chữ ký hoặc hết hạn 5 phút) hoặc `purpose !== "RESET_PASSWORD"` thì `INVALID_RESET_PASSWORD_TOKEN`.
  4. Không tìm thấy user theo `email` trong token thì `USER_NOT_FOUND`.
- **Side effect:** cập nhật `passwordHash` (bcrypt cost 10) và thu hồi toàn bộ refresh token của user trong Redis (`refresh_token:<userId>:*`). Token reset không bị vô hiệu hóa sau khi dùng: có thể dùng lại đến khi hết hạn 5 phút.
- **Thành công `200`:**
  ```json
  {
    "success": true,
    "message": "Mật khẩu đã được thay đổi thành công.",
    "data": null
  }
  ```
- **Lỗi thường gặp:**
  - `MISSING_REQUIRED_FIELDS` (400), `PASSWORD_MISMATCH` (400)
  - `USER_NOT_FOUND` (404)
  - `INVALID_RESET_PASSWORD_TOKEN` (hiện trả `500`, message mặc định)

---

## GET `/auth/google`

Khởi tạo Google OAuth 2.0 (Authorization Code flow). Frontend điều hướng trình duyệt tới URL này.

- **Quyền hạn:** Không cần đăng nhập.
- **Xử lý:**
  - Sinh `state` ngẫu nhiên (32 byte, hex 64 ký tự) và set cookie `oauth_state`: `httpOnly`, `sameSite=lax`, `secure` chỉ khi `NODE_ENV=production`, `maxAge` 10 phút.
  - Redirect (HTTP `302`) tới `https://accounts.google.com/o/oauth2/v2/auth` với các tham số: `client_id`, `redirect_uri` (= `GOOGLE_CALLBACK_URL`), `response_type=code`, `scope=openid email profile`, `state`, `access_type=offline`, `prompt=consent`.
- **Lỗi cấu hình** (thiếu `GOOGLE_CLIENT_ID` hoặc `GOOGLE_CALLBACK_URL`/`GOOGLE_REDIRECT_URI`):
  - Nếu có `FRONTEND_OAUTH_ERROR_URL`: redirect tới `FRONTEND_OAUTH_ERROR_URL?reason=config`.
  - Nếu không: `500` với body là text thuần (`FRONTEND_OAUTH_ERROR_URL is not set ...`).

---

## GET `/auth/google/callback`

Callback mà Google gọi sau khi người dùng đồng ý. Không trả JSON, luôn kết thúc bằng redirect về frontend.

- **Quyền hạn:** Không cần đăng nhập.
- **Query do Google gửi:** `code`, `state`.
- **Điều kiện tiên quyết:** phải cấu hình cả `FRONTEND_OAUTH_SUCCESS_URL` và `FRONTEND_OAUTH_ERROR_URL`, nếu thiếu 1 trong 2 thì `500` với body text thuần (`Set FRONTEND_OAUTH_SUCCESS_URL and FRONTEND_OAUTH_ERROR_URL in .env ...`).
- **Luồng xử lý:**
  1. Thiếu `code`, thiếu `state`, thiếu cookie `oauth_state` hoặc `state` khác cookie thì xóa cookie và redirect `FRONTEND_OAUTH_ERROR_URL?reason=state` (bao gồm cả trường hợp người dùng từ chối cấp quyền vì Google không gửi `code`).
  2. Xóa cookie `oauth_state`, đổi `code` lấy token tại `https://oauth2.googleapis.com/token`, xác minh `id_token` bằng `GOOGLE_CLIENT_ID`. Google phải trả `sub` và `email` với `email_verified = true`. Tên hiển thị lấy từ Google, nếu trống thì lấy phần trước `@` của email.
  3. Xác định tài khoản:
     - Có user với `googleId = sub`: đăng nhập user đó.
     - Không có, nhưng có user cùng email (đã chuẩn hóa chữ thường): nếu user đó đã gắn `googleId` khác thì lỗi `GOOGLE_ACCOUNT_CONFLICT`; nếu chưa có `googleId` thì tự động liên kết `googleId` vào tài khoản đó và đăng nhập.
     - Chưa có user nào: tạo user mới với `email`, `googleId`, `name`, `passwordHash = null`, `emailVerifiedAt = hiện tại`, `role = USER`, `status = ACTIVE` (`phone` và `dateOfBirth` để trống).
  4. Phát hành access token + refresh token giống `/auth/login` (lưu hash refresh token vào Redis, TTL 7 ngày). Không kiểm tra `status` của user.
- **Kết quả (HTTP `302`):**
  - Thành công: `FRONTEND_OAUTH_SUCCESS_URL?accessToken=<jwt>&refreshToken=<jwt>`
  - Lỗi: `FRONTEND_OAUTH_ERROR_URL?reason=<lý do>`

  | `reason` | Nguyên nhân |
  | --- | --- |
  | `config` | (Chỉ ở `/auth/google`) thiếu cấu hình Google OAuth |
  | `state` | Thiếu `code`/`state`/cookie hoặc `state` không khớp |
  | `google` | Mọi lỗi còn lại trong quá trình xử lý: `GOOGLE_TOKEN_EXCHANGE_FAILED`, `GOOGLE_NO_ID_TOKEN`, `GOOGLE_EMAIL_NOT_VERIFIED`, `GOOGLE_ACCOUNT_CONFLICT`, id_token không hợp lệ, lỗi database/Redis |

- **Ghi chú:** để test khi chưa có frontend có thể trỏ `FRONTEND_OAUTH_SUCCESS_URL`/`FRONTEND_OAUTH_ERROR_URL` vào `/oauth/success` và `/oauth/error` của server (các trang hiển thị query params).
