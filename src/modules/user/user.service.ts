import { UserRole, UserStatus } from "@prisma/client";
import { UserRepository, UserListRow } from "./user.repository";
import {
    ListUserQueryDto,
    PaginatedUserListDto,
    UserListItemDto,
    UpdateProfileDto,
    CreateUserDto,
    UpdateUserDto,
    UpdateStatusDto,
    SoftDeleteUserDto,
    ResetPasswordDto,
    UserStatsDto
} from "./user.dto";
import bcrypt from "bcrypt";
import { sendWelcomeStaffMail } from "../../services/mail.service";
import { PrismaClient } from "@prisma/client"

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function mapRow(row: UserListRow): UserListItemDto {
    return {
        id: row.id,
        email: row.email,
        name: row.name,
        phone: row.phone,
        dateOfBirth: row.dateOfBirth,
        role: row.role,
        status: row.status,
        avatarUrl: row.avatarUrl,
        gender: row.gender,
        citizenId: row.citizenId,
        address: row.address,
        emergencyContact: row.emergencyContact,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

function toIso(d: Date | null): string | null {
    return d ? d.toISOString() : null;
}

export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly prisma : PrismaClient
    ) { }

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

    // 2. Người dùng tự cập nhật thông tin cá nhân
    public async updateProfile(userId: number, dto: UpdateProfileDto): Promise<UserListItemDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const updateData: any = {};
        if (dto.name !== undefined) updateData.name = dto.name;

        if (dto.phone !== undefined) {
            if (dto.phone !== null && dto.phone !== "") {
                const phoneExisted = await this.userRepository.findByPhone(dto.phone);
                if (phoneExisted && phoneExisted.id !== userId) {
                    throw new Error("PHONE_ALREADY_EXISTS");
                }
                updateData.phone = dto.phone;
            } else {
                updateData.phone = null;
            }
        }

        if (dto.dateOfBirth !== undefined) {
            updateData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
        }

        if (dto.citizenId !== undefined) {
            if (dto.citizenId !== null && dto.citizenId.trim() !== "") {
                const citizenExisted = await this.userRepository.findByCitizenId(dto.citizenId.trim());
                if (citizenExisted && citizenExisted.id !== userId) {
                    throw new Error("CITIZEN_ID_ALREADY_EXISTS");
                }
                updateData.citizenId = dto.citizenId.trim();
            } else {
                updateData.citizenId = null;
            }
        }

        if (dto.gender !== undefined) updateData.gender = dto.gender;
        if (dto.address !== undefined) updateData.address = dto.address;
        if (dto.emergencyContact !== undefined) updateData.emergencyContact = dto.emergencyContact;

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
        if (dto.phone !== undefined && dto.phone !== null && dto.phone !== "") {
            const phoneExisted = await this.userRepository.findByPhone(dto.phone);
            if (phoneExisted) {
                throw new Error("PHONE_ALREADY_EXISTS");
            }
        }
        if (dto.citizenId !== undefined && dto.citizenId !== null && dto.citizenId.trim() !== "") {
            const citizenExisted = await this.userRepository.findByCitizenId(dto.citizenId.trim());
            if (citizenExisted) {
                throw new Error("CITIZEN_ID_ALREADY_EXISTS");
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
            avatarUrl: dto.avatarUrl || null,
            gender: dto.gender || null,
            citizenId: dto.citizenId ? dto.citizenId.trim() : null,
            address: dto.address || null,
            emergencyContact: dto.emergencyContact || null,
        });

        if(newUser.role === UserRole.COACH){
            await this.prisma.coachProfile.create({
                data : {
                    userId : newUser.id,
                    isAvailable : true
                }
            })
        }

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

        if (dto.phone !== undefined) {
            if (dto.phone !== null && dto.phone !== "") {
                const phoneExisted = await this.userRepository.findByPhone(dto.phone);
                if (phoneExisted && phoneExisted.id !== targetId) {
                    throw new Error("PHONE_ALREADY_EXISTS");
                }
                updateData.phone = dto.phone;
            } else {
                updateData.phone = null;
            }
        }

        if (dto.citizenId !== undefined) {
            if (dto.citizenId !== null && dto.citizenId.trim() !== "") {
                const citizenExisted = await this.userRepository.findByCitizenId(dto.citizenId.trim());
                if (citizenExisted && citizenExisted.id !== targetId) {
                    throw new Error("CITIZEN_ID_ALREADY_EXISTS");
                }
                updateData.citizenId = dto.citizenId.trim();
            } else {
                updateData.citizenId = null;
            }
        }

        if (dto.role !== undefined) updateData.role = dto.role;
        if (dto.dateOfBirth !== undefined) {
            updateData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
        }
        if (dto.gender !== undefined) updateData.gender = dto.gender;
        if (dto.address !== undefined) updateData.address = dto.address;
        if (dto.emergencyContact !== undefined) updateData.emergencyContact = dto.emergencyContact;

        const updated = await this.userRepository.update(targetId, updateData);

        if(updated.role === UserRole.COACH){
            //Kiem tra xem PT da co ho so chua, neu co roi thi khong tao lai
            const existedProfile = await this.prisma.coachProfile.findUnique({ where : { userId: targetId } });
            if(!existedProfile){
                await this.prisma.coachProfile.create({
                    data: {
                        userId : targetId,
                        isAvailable : true
                    }
                })
            }
        }
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

    // 7. Cập nhật ảnh đại diện người dùng
    public async updateAvatar(userId: number, avatarUrl: string): Promise<UserListItemDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new Error("USER_NOT_FOUND");
        }
        const updated = await this.userRepository.update(userId, {
            avatarUrl
        });
        return mapRow(updated);
    }

    //8.Admin/Staff khóa mềm tài khoản người dùng (soft delete)
    public async softDeleteUser(actorRole: string, userId: number, dto: SoftDeleteUserDto): Promise<UserListItemDto> {
        return await this.updateUserStatus(actorRole, userId, { status: UserStatus.DELETED });
    }

    //9.Admin/Staff reset mat khau nguoi dung
    public async resetPassword(actorRole: string, userId: number, dto: ResetPasswordDto): Promise<UserListItemDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }

        const targetUser = await this.userRepository.findById(userId);
        if (!targetUser) {
            throw new Error("USER_NOT_FOUND");
        }

        if (actorRole === UserRole.STAFF && targetUser.role === UserRole.ADMIN) {
            throw new Error("FORBIDDEN");
        }

        const newPassword = dto.newPassword || "GymManager@123";
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const updated = await this.userRepository.update(userId, {
            passwordHash
        });

        return mapRow(updated);
    }

    // 9.Api dashboard thong ke so luong nguoi dung theo tung role
    public async getUserStats(actorRole: string): Promise<UserStatsDto> {
        const allowed: UserRole[] = [UserRole.ADMIN, UserRole.STAFF];
        if (!allowed.includes(actorRole as UserRole)) {
            throw new Error("FORBIDDEN");
        }

        return await this.userRepository.getUserStats();
    }
}