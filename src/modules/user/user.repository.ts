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
} satisfies Prisma.UserSelect;

export type UserListRow = Prisma.UserGetPayload<{ select: typeof userListSelect }> ;

export class UserRepository {
    constructor( private readonly prisma: PrismaClient) {}

    public async findManyPaginated(params: {
        skip: number;
        take: number;
        role? : UserRole;
        status? : UserStatus;
        search? : string;
    }): Promise<{ rows: UserListRow[]; total: number }> {
        const where : Prisma.UserWhereInput = {};

        if(params.role) where.role = params.role;
        if(params.status) {
            where.status = params.status;
        } else {
            where.status = { not: UserStatus.DELETED };
        }

        if(params.search?.trim()) {
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
    public async findById(id : number): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({
            where : { id },
            select : userListSelect, 
        });
    }
    //Time kiem user theo email
    public async findByEmail(email : string): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({ where : { email }, select : userListSelect });
    }

    //Time kiem user theo phone
    public async findByPhone(phone : string): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({ where : { phone }, select : userListSelect });
    }

    // Tim kiem user theo citizenId (CCCD)
    public async findByCitizenId(citizenId : string): Promise<UserListRow | null> {
        return this.prisma.user.findUnique({ where : { citizenId }, select : userListSelect });
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
}