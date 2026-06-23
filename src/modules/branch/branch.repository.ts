import { PrismaClient } from '@prisma/client'
import { CreateBranchDto, UpdateBranchDto } from './branch.dto'

export class BranchRepository {
    constructor(private readonly prisma: PrismaClient) {}

    //Tim nhieu chi nhanh co phan trang
    public async findMany(where: any, skip: number, take: number) {
        return this.prisma.gymBranch.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: 'desc' },
        });
    }

    //Dem tong so luong chi nhanh theo dieu kien
    public async count(where : any) {
        return this.prisma.gymBranch.count({ where });
    }

    //Tim chi nhanh theo id
    public async findById(id : number) {
        return this.prisma.gymBranch.findUnique({ where : { id } });
    }

    //Tim chi nhanh theo ma code
    public async findByCode(code : string) {
        return this.prisma.gymBranch.findUnique({ where : { code } });
    }

    //Tao chi nhanh moi
    public async create(dto: CreateBranchDto) {
        return this.prisma.gymBranch.create({
            data : {
                name : dto.name,
                code: dto.code,
                address : dto.address,
                phone: dto.phone ?? null,
                isActive: dto.isActive !== undefined ? !!dto.isActive : true
            }
        })
    }

    //Cap nhat chi nhanh
    public async update(id : number, dto : UpdateBranchDto) {
        return this.prisma.gymBranch.update({
            where : { id },
            data: {
                ...(dto.name !== undefined && { name : dto.name }),
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            }
        })
    }

    //Bat hoat dong chi nhanh
    public async setStatus(id: number, isActive : boolean){
        return this.prisma.gymBranch.update({
            where : { id },
            data: { isActive }
        })
    }
}