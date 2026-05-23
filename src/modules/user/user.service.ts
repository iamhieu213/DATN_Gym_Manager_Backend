import { UserRole } from "@prisma/client";
import { UserRepository, UserListRow } from "./user.repository";
import { ListUserQueryDto, PaginatedUserListDto, UserListItemDto, UpdateProfileDto, CreateUserDto, UpdateUserDto, UpdateStatusDto } from "./user.dto";
import bcrypt from "bcrypt";
import { sendWelcomeStaffMail } from "../../services/mail.service";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function mapRow(row: UserListRow): UserListItemDto {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone!,
        dateOfBirth: row.dateOfBirth!,
        role: row.role,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

function toIso(d: Date | null): string | null {
    return d ? d.toISOString() : null;
}

export class UserService {
    constructor(private readonly userRepository: UserRepository) { }

    //Hien thi danh sach nguoi dung 
    public async getAllUsers(actorRole: string, query: ListUserQueryDto): Promise<PaginatedUserListDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];

        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("UNAUTHORIZED");
        }

        const page = Math.max(
            1,
            parseInt(String(query.page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE
        );
        const limitRaw =
            parseInt(String(query.limit ?? DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
        const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);
        const skip = (page - 1) * limit;

        const { rows, total } = await this.userRepository.findManyPaginated({
            skip,
            take: limit,
            ...(query.role !== undefined ? { role: query.role } : {}),
            ...(query.status !== undefined ? { status: query.status } : {}),
            ...(query.search !== undefined && query.search !== ""
                ? { search: query.search }
                : {}),
        });

        const totalPages = Math.ceil(total / limit) || 0;

        return {
            data: rows.map(mapRow),
            meta: {
                page,
                limit,
                total,
                totalPages,
            }
        }

    }

    //Hien thi thong tin ca nhan cua nguoi dung dang nhap
    public async getUserProfile(userId: number): Promise<UserListItemDto> {
        const user = await this.userRepository.findById(userId);

        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }

        return mapRow(user);
    }

    // 2. Người dùng tự cập nhật thông tin cá nhân (chỉ đổi Tên, SĐT, Ngày sinh)
    public async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserListItemDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const updateData: any = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.phone !== undefined) updateData.phone = dto.phone;
        if (dto.dateOfBirth !== undefined) {
            updateData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
        }
        const updatedUser = await this.userRepository.update(userId, updateData);
        return mapRow(updatedUser);
    }

    // 3. ADMIN/STAFF xem chi tiết thông tin một người dùng bất kỳ
    public async getUserDetail(actorRole: string, targetId: number): Promise<UserListItemDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }
        const user = await this.userRepository.findById(targetId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        return mapRow(user);
    }

    // 4. ADMIN/STAFF tạo tài khoản mới (ví dụ tạo cho HLV, Nhân viên mới)
    public async createUser(actorRole: string, dto: CreateUserDto): Promise<UserListItemDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }
        // Nhân viên thường (STAFF) không thể tự tạo tài khoản ADMIN
        if (actorRole === UserRole.STAFF && dto.role === UserRole.ADMIN) {
            throw new Error("FORBIDDEN");
        }
        const email = dto.email.trim().toLowerCase();
        const existed = await this.userRepository.findByEmail(email);
        if (existed) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }
        if (dto.phone !== undefined) {
            const phoneExisted = await this.userRepository.findByPhone(dto.phone);
            if (phoneExisted) {
                throw new Error("PHONE_ALREADY_EXISTS");
            }
        }
        // Sử dụng mật khẩu được gửi lên, hoặc tự gán mật khẩu mặc định nếu trống
        const password = dto.password || "GymManager@123";
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await this.userRepository.create({
            email,
            passwordHash,
            name: dto.name,
            phone: dto.phone || null,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            role: dto.role || UserRole.USER,
            status: dto.status || "ACTIVE",
        });

        sendWelcomeStaffMail(newUser.email, newUser.name, newUser.role, password)
            .catch(err => console.error("Lỗi gửi mail chào mừng nhân viên:", err));

        return mapRow(newUser);
    }
    // 5. ADMIN/STAFF cập nhật thông tin người dùng
    public async updateUser(actorRole: string, targetId: number, dto: UpdateUserDto): Promise<UserListItemDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }
        const targetUser = await this.userRepository.findById(targetId);
        if (!targetUser) {
            throw new Error("USER_NOT_FOUND");
        }
        // STAFF không được phép chỉnh sửa tài khoản ADMIN
        if (actorRole === UserRole.STAFF && targetUser.role === UserRole.ADMIN) {
            throw new Error("FORBIDDEN");
        }
        // STAFF không được phép nâng quyền của ai đó lên ADMIN
        if (actorRole === UserRole.STAFF && dto.role === UserRole.ADMIN) {
            throw new Error("FORBIDDEN");
        }
        const updateData: any = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.phone !== undefined) updateData.phone = dto.phone;
        if (dto.role !== undefined) updateData.role = dto.role;
        if (dto.dateOfBirth !== undefined) {
            updateData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
        }
        const updated = await this.userRepository.update(targetId, updateData);
        return mapRow(updated);
    }
    // 6. ADMIN/STAFF khóa hoặc mở khóa tài khoản
    public async updateUserStatus(actorRole: string, targetId: number, dto: UpdateStatusDto): Promise<UserListItemDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }
        const targetUser = await this.userRepository.findById(targetId);
        if (!targetUser) {
            throw new Error("USER_NOT_FOUND");
        }
        // STAFF không được khóa tài khoản ADMIN
        if (actorRole === UserRole.STAFF && targetUser.role === UserRole.ADMIN) {
            throw new Error("FORBIDDEN");
        }
        const updated = await this.userRepository.update(targetId, {
            status: dto.status
        });
        return mapRow(updated);
    }
}