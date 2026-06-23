import { CreateBranchDto, UpdateBranchDto, ListBranchQueryDto } from "./branch.dto";
import { BranchRepository } from "./branch.repository";

export class BranchService {
    constructor( private readonly repository: BranchRepository) {}

    //Chi co admin moi duoc thay doi du lieu chi nhanh
    private verifyAdmin(role : string) {
        if(role !== 'ADMIN'){
            throw new Error('FORBIDDEN');
        }
    }

    //Lay danh sach chi nhanh kem phan trang va tim kiem
    public async getAllBranches(query: ListBranchQueryDto) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;
        const where : any = {};

        if(query.isActive !== undefined) {
            where.isActive = query.isActive === 'true';
        }

        if(query.search) {
            where.OR = [
                { name : { contains : query.search, mode : 'insensitive' } },
                { address: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } }
            ];
        }

        const [branches, total] = await Promise.all([
            this.repository.findMany(where, skip, limit),
            this.repository.count(where)
        ]);

        return {
            data: branches,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total/limit)
            }
        }
    }

    //Lay thong tin 1 chi nhanh theo id
    public async getBranchById(id : number) {
        const branch = await this.repository.findById(id);

        if(!branch) throw new Error("BRANCH_NOT_FOUND");

        return branch;
    }

    //Tao chi nhanh moi
    public async createBranch(role : string, dto: CreateBranchDto) {
        this.verifyAdmin(role);

        if(!dto.name || !dto.code || !dto.address) {
            throw new Error("MISSING_REQUIRED_FIELDS");
        }

        const existed = await this.repository.findByCode(dto.code);
        if(existed) throw new Error("BRANCH_CODE_ALREADY_EXISTS");

        return this.repository.create(dto);
    }

    //Cap nhat thong tin chi nhanh moi
    public async updateBranch(role: string, id : number, dto : UpdateBranchDto) {
        this.verifyAdmin(role);

        const existed = await this.repository.findById(id);

        if(!existed) throw new Error("BRANCH_NOT_FOUND");

        if(dto.code && dto.code !== existed.code) {
            const duplicate = await this.repository.findByCode(dto.code);

            if(duplicate) throw new Error("BRANCH_CODE_ALREADY_EXISTS");
        }

        return this.repository.update(id, dto);
    }

    //Kich hoat phong tap
    public async activateBranch(role : string, id : number) {
        this.verifyAdmin(role);

        const existed = await this.repository.findById(id);

        if (!existed) {
            throw new Error("BRANCH_NOT_FOUND");
        }

        return this.repository.setStatus(id, true);
    }

    //Dong phong tap
    public async deactivateBranch(role : string, id : number) {
        this.verifyAdmin(role);

        const existed = await this.repository.findById(id);

        if (!existed) {
            throw new Error("BRANCH_NOT_FOUND");
        }

        return this.repository.setStatus(id, false);
    }
}