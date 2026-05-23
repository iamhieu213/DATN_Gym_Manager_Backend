import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { UserService } from "./user.service";
import { prisma } from "../../config/client";
import { ListUserQueryDto, CreateUserDto, UpdateProfileDto, UpdateStatusDto, UpdateUserDto, UpdateAvatarDto, SoftDeleteUserDto, ResetPasswordDto } from "./user.dto";
import { UserRepository } from "./user.repository";
import { uploadToCloudinary } from "../../services/cloudinary.service";

const userService = new UserService(new UserRepository(prisma));

const mapErrorStatus = (code: string): number => {
    switch (code) {
        case "UNAUTHORIZED":
            return 401;
        case "FORBIDDEN":
            return 403;
        case "USER_NOT_FOUND":
            return 404;
        case "EMAIL_ALREADY_EXISTS":
        case "PHONE_ALREADY_EXISTS":
        case "CITIZEN_ID_ALREADY_EXISTS":
            return 409;
        case "BAD_REQUEST":
        case "INVALID_ID":
            return 400;
        default:
            return 500;
    }
};

const mapErrorMessage = (code: string): string => {
    switch (code) {
        case "UNAUTHORIZED":
            return "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.";
        case "FORBIDDEN":
            return "Bạn không có quyền thực hiện chức năng này.";
        case "USER_NOT_FOUND":
            return "Không tìm thấy thông tin người dùng.";
        case "EMAIL_ALREADY_EXISTS":
            return "Email này đã tồn tại trong hệ thống.";
        case "PHONE_ALREADY_EXISTS":
            return "Số điện thoại này đã tồn tại trong hệ thống.";
        case "CITIZEN_ID_ALREADY_EXISTS":
            return "Số CCCD này đã tồn tại trong hệ thống.";
        case "BAD_REQUEST":
            return "Yêu cầu không hợp lệ.";
        case "INVALID_ID":
            return "ID người dùng không hợp lệ.";
        default:
            return "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.";
    }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.userId || !req.user?.role) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }

        const result = await userService.getAllUsers(req.user.role, req.query as ListUserQueryDto);
        res.status(200).json({
            success: true,
            message: "Lấy danh sách người dùng thành công.",
            data: result.data,
            meta: result.meta
        });

    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
}

// 2. Lấy thông tin cá nhân của người đăng nhập
export const getMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }
        const result = await userService.getUserProfile(req.user.userId);
        res.status(200).json({
            success: true,
            message: "Lấy thông tin cá nhân thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 3. Người dùng tự cập nhật thông tin cá nhân
export const updateMyProfile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }
        const result = await userService.updateProfile(req.user.userId, req.body as UpdateProfileDto);
        res.status(200).json({
            success: true,
            message: "Cập nhật thông tin cá nhân thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 3b. Người dùng tự cập nhật ảnh đại diện
export const updateMyAvatar = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Vui lòng chọn một file ảnh để tải lên.",
                error: "BAD_REQUEST"
            });
        }

        // Upload file buffer lên Cloudinary
        const avatarUrl = await uploadToCloudinary(req.file.buffer, "gym_avatars");

        const result = await userService.updateAvatar(req.user.userId, avatarUrl);
        res.status(200).json({
            success: true,
            message: "Cập nhật ảnh đại diện thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 4. Xem chi tiết thông tin một người dùng khác (ADMIN/STAFF)
export const getUserById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.role) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }
        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const result = await userService.getUserDetail(req.user.role, id);
        res.status(200).json({
            success: true,
            message: "Lấy chi tiết người dùng thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 5. Tạo mới người dùng (ADMIN/STAFF)
export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.role) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }
        const result = await userService.createUser(req.user.role, req.body as CreateUserDto);
        res.status(201).json({
            success: true,
            message: "Tạo người dùng mới thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 6. Cập nhật thông tin người dùng khác (ADMIN/STAFF)
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.role) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }

        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const result = await userService.updateUser(req.user.role, id, req.body as UpdateUserDto);
        res.status(200).json({
            success: true,
            message: "Cập nhật thông tin người dùng thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

// 7. Thay đổi trạng thái tài khoản (ADMIN/STAFF)
export const updateUserStatus = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user?.role) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }

        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const result = await userService.updateUserStatus(req.user.role, id, req.body as UpdateStatusDto);
        res.status(200).json({
            success: true,
            message: "Cập nhật trạng thái tài khoản thành công.",
            data: result
        });
    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        });
    }
};

//8.Xoa mem nguoi dung (soft delete) (ADMIN/STAFF)
export const softDeleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role;
        if (!userId || !role) {
            return res.status(401).json({
                success: false,
                message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                error: "UNAUTHORIZED"
            });
        }
        if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            })
        }
        const result = await userService.softDeleteUser(role, id, req.body as SoftDeleteUserDto);
        res.status(200).json({
            success: true,
            message: "Xóa mềm tài khoản người dùng thành công.",
            data: result
        });

    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        })
    }
}

// 9. Reset mật khẩu người dùng (ADMIN/STAFF)
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
    try {
         const userId = req.user?.userId;
         const role = req.user?.role;
         if (!userId || !role) {
             return res.status(401).json({
                 success: false,
                 message: "Bạn chưa đăng nhập hoặc phiên làm việc đã hết hạn.",
                 error: "UNAUTHORIZED"
             });
         }
         if (!req.params.id || Array.isArray(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            });
        }
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "ID người dùng không hợp lệ.",
                error: "INVALID_ID"
            })
        }
        const result = await userService.resetPassword(role, id, req.body as ResetPasswordDto);
        res.status(200).json({
            success: true,
            message: "Reset mật khẩu người dùng thành công.",
            data: result
        });

    } catch (error) {
        const code = error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR";
        res.status(mapErrorStatus(code)).json({
            success: false,
            message: mapErrorMessage(code),
            error: code
        })
    }
}



