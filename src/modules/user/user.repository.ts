import { Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";

const userListSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    dateOfBirth: true,
    role: true,
    status: true,
    avatarUrl: true,
    gender: true,
    citizenId: true,
    address: true,
    emergencyContact: true,
    createdAt: true,
    updatedAt: true,
    branchId: true,
    branch: {
        select: {
            id: true,
            name: true,
            code: true
        }
    }
} satisfies Prisma.UserSelect;

export type UserListRow = Prisma.UserGetPayload<{ select: typeof userListSelect }>;

export class UserRepository {
    constructor(private readonly prisma: PrismaClient) { }

    public async findManyPaginated(params: {
        skip: number;
        take: number;
        role?: UserRole;
        status?: UserStatus;
        search?: string;
        branchId?: number;
    }): Promise<{ rows: UserListRow[]; total: number }> {
        const where: Prisma.UserWhereInput = {};

        if (params.role) where.role = params.role;
        if (params.branchId) where.branchId = params.branchId;
        if (params.status) {
            where.status = params.status;
        } else {
            where.status = { not: UserStatus.DELETED };
        }

        if (params.branchId) {
            where.AND = [
                {
                    OR: [
                        { branchId: params.branchId }, // Thuộc chi nhánh
                        { role: UserRole.USER }        // Hoặc là hội viên tập tự do
                    ]
                }
            ];
        }

        if (params.search?.trim()) {
            const q = params.search.trim();
            where.OR = [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { citizenId: { contains: q, mode: "insensitive" } },
            ];
        }

        const [rows, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: userListSelect,
                orderBy: { createdAt: "desc" },
                skip: params.skip,
                take: params.take,
            }),
            this.prisma.user.count({ where }),
        ]);

        return { rows, total };
    }

    //Tim kiem user theo Id
    public async findById(id: number): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({
            where: { id },
            select: userListSelect,
        });
    }
    //Time kiem user theo email
    public async findByEmail(email: string): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({ where: { email }, select: userListSelect });
    }

    //Time kiem user theo phone
    public async findByPhone(phone: string): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({ where: { phone }, select: userListSelect });
    }

    // Tim kiem user theo citizenId (CCCD)
    public async findByCitizenId(citizenId: string): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({ where: { citizenId }, select: userListSelect });
    }

    // 3. Tạo mới user vào DB
    public async create(data: Prisma.UserCreateInput): Promise<UserListRow> {
        return this.prisma.user.create({
            data,
            select: userListSelect,
        });
    }
    // 4. Cập nhật thông tin user
    public async update(id: number, data: Prisma.UserUpdateInput): Promise<UserListRow> {
        return this.prisma.user.update({
            where: { id },
            data,
            select: userListSelect,
        });
    }

    //Thong ke so luong nguoi dung 
    public async getUserStats(branchId?: number): Promise<any> {
        const now = new Date();

        //Lay moc thoi gian bat dau cua ngay hom nay
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        //Lay moc thoi gian bat dau cua thang nay
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        // Tạo cấu trúc where lọc theo chi nhánh nếu có
        const whereClause: Prisma.UserWhereInput = {
            status: { not: 'DELETED' },
            ...(branchId ? { branchId } : {})
        };

        const [roleGroups, statusGroups, totalCount, todayCount, monthCount] = await Promise.all([
            // Nhóm và đếm số lượng theo Vai trò (loại trừ tài khoản đã xóa DELETED)
            this.prisma.user.groupBy({
                by: ['role'],
                _count: { id: true },
                where: whereClause
            }),
            // Nhóm và đếm số lượng theo Trạng thái hoạt động
            this.prisma.user.groupBy({
                by: ['status'],
                _count: { id: true },
                where: whereClause
            }),
            // Tổng số người dùng thực tế
            this.prisma.user.count({
                where: whereClause
            }),
            // Số lượng người dùng đăng ký mới trong ngày hôm nay
            this.prisma.user.count({
                where: {
                    ...whereClause,
                    createdAt: { gte: startOfToday }
                }
            }),
            // Số lượng người dùng đăng ký mới trong tháng này
            this.prisma.user.count({
                where: {
                    ...whereClause,
                    createdAt: { gte: startOfMonth }
                }
            })
        ]);
        // Định dạng và gán giá trị mặc định cho phân loại Role
        const byRole = { ADMIN: 0, COACH: 0, STAFF: 0, USER: 0 };
        roleGroups.forEach(g => {
            byRole[g.role] = g._count.id;
        });
        // Định dạng và gán giá trị mặc định cho phân loại Status
        const byStatus = { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0, BANNED: 0 };
        statusGroups.forEach(g => {
            if (g.status !== 'DELETED') {
                byStatus[g.status as Exclude<typeof g.status, 'DELETED'>] = g._count.id;
            }
        });
        return {
            totalUsers: totalCount,
            byRole,
            byStatus,
            newRegistrations: {
                today: todayCount,
                thisMonth: monthCount
            }
        };
    }
}