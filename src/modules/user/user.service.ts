import { UserRole } from "@prisma/client";
import { UserRepository, UserListRow } from "./user.repository";
import { ListUserQueryDto, PaginatedUserListDto, UserListItemDto } from "./user.dto";

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
}