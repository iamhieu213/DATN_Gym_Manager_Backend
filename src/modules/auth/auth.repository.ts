import { PrismaClient, User, UserRole, UserStatus } from '@prisma/client';

interface CreateLocalUserInput {
    email: string;
    passwordHash: string;
    name: string;
    phone: string;
    dateOfBirth: Date;
}

export class AuthRepository {
    constructor(private readonly prisma: PrismaClient) { }

    public async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    public async createLocalUser(input: CreateLocalUserInput): Promise<User> {
        return this.prisma.user.create({
            data: {
                email: input.email,
                passwordHash: input.passwordHash,
                name: input.name,
                phone: input.phone,
                dateOfBirth: input.dateOfBirth,
                emailVerifiedAt: new Date(),
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
            }
        })
    }

    public async findUserByGoogleId(googleId: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { googleId } });
    }

    public async linkGoogleAccount(userId: string, googleId: string): Promise<User> {
        return this.prisma.user.update({
            where: { id: userId },
            data: { googleId },
        });
    }

    public async createGoogleOnlyUser(input: {
        email: string;
        googleId: string;
        name: string;
    }): Promise<User> {
        return this.prisma.user.create({
            data: {
                email: input.email,
                googleId: input.googleId,
                name: input.name,
                passwordHash: null,
                emailVerifiedAt: new Date(),
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
            }
        });
    }
}