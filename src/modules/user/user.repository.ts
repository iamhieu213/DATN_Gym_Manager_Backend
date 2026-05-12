import { Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";

const userListSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    dateOfBirth: true,
    role: true,
    status: true,
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
        if(params.status) where.status = params.status;

        if(params.search?.trim()) {
            const q = params.search.trim();
            where.OR = [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
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
}