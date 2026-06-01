# Auth API

Base path: `/auth`

## Tổng quan

Module xác thực tài khoản, OTP đăng ký/quên mật khẩu, refresh token, logout, đổi mật khẩu và Google OAuth.

## POST `/auth/register`

Đăng ký tài khoản local và gửi OTP tới email.

Auth: không cần.

Body:

```json
{
  "email": "user@example.com",
  "password": "password",
  "name": "Nguyen Van A",
  "phone": "0900000000",
  "dateOfBirth": "2000-01-01"
}
```

Thành công `201`:

```json
{
  "success": true,
  "message": "Mã OTP đã được gửi tới email...",
  "data": {
    "email": "user@example.com",
    "registerToken": "<registerToken>"
  }
}
```

Lỗi thường gặp: `EMAIL_ALREADY_EXISTS`, `PHONE_ALREADY_EXISTS`, `OTP_LIMIT_EXCEEDED`.

## POST `/auth/verify-register`

Xác thực OTP để tạo tài khoản.

Auth: không cần.

Body:

```json
{
  "email": "user@example.com",
  "registerToken": "<registerToken>",
  "otpCode": "123456"
}
```

Thành công `200`:

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

Lỗi thường gặp: `OTP_INVALID_OR_EXPIRED`, `INVALID_REGISTER_TOKEN`, `TOKEN_EMAIL_MISMATCH`, `REGISTER_TOKEN_EXPIRED`.

## POST `/auth/login`

Đăng nhập bằng email/password.

Auth: không cần.

Body:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Thành công `200`:

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

Lỗi thường gặp: `INVALID_CREDENTIALS`, `LOGIN_LOCKED`.

## POST `/auth/refresh-access-token`

Cấp lại access token từ refresh token.

Auth: không cần.

Body:

```json
{
  "refreshToken": "<refreshToken>"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Làm mới access token thành công.",
  "data": {
    "accessToken": "<jwt>"
  }
}
```

## POST `/auth/logout`

Xóa refresh token khỏi Redis.

Auth: không cần.

Body:

```json
{
  "refreshToken": "<refreshToken>"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Đăng xuất thành công.",
  "data": null
}
```

## POST `/auth/change-password`

Đổi mật khẩu của user đang đăng nhập.

Auth: cần Bearer token.

Body:

```json
{
  "oldPassword": "old-password",
  "newPassword": "new-password",
  "confirmNewPassword": "new-password"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Đổi mật khẩu thành công.",
  "data": null
}
```

Lỗi thường gặp: `UNAUTHORIZED`, `PASSWORD_MISMATCH`, `INVALID_OLD_PASSWORD`, `MISSING_REQUIRED_FIELDS`.

## POST `/auth/request-forgot-password-otp`

Gửi OTP quên mật khẩu.

Auth: không cần.

Body:

```json
{
  "email": "user@example.com"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Mã OTP đã được gửi tới email...",
  "data": null
}
```

Ghi chú: nếu email không tồn tại, service trả thành công im lặng để tránh lộ thông tin.

## POST `/auth/verify-forgot-password-otp`

Xác thực OTP quên mật khẩu và lấy reset token.

Auth: không cần.

Body:

```json
{
  "email": "user@example.com",
  "otpCode": "123456"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Xác thực mã OTP thành công...",
  "data": {
    "resetPasswordToken": "<resetPasswordToken>"
  }
}
```

## POST `/auth/reset-password`

Đặt lại mật khẩu bằng reset token.

Auth: không cần.

Body:

```json
{
  "resetPasswordToken": "<resetPasswordToken>",
  "newPassword": "new-password",
  "confirmNewPassword": "new-password"
}
```

Thành công `200`:

```json
{
  "success": true,
  "message": "Mật khẩu đã được thay đổi thành công.",
  "data": null
}
```

## GET `/auth/google`

Khởi tạo Google OAuth.

Auth: không cần.

Trả về: HTTP redirect tới Google authorization URL. Server set cookie `oauth_state`.

## GET `/auth/google/callback`

Callback Google OAuth.

Auth: không cần.

Query do Google gửi: `code`, `state`.

Trả về: redirect tới `FRONTEND_OAUTH_SUCCESS_URL?accessToken=...&refreshToken=...` nếu thành công, hoặc `FRONTEND_OAUTH_ERROR_URL?reason=...` nếu lỗi.

