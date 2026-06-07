import 'dotenv/config';
import { UserRole, UserStatus, Gender, TrainingGoal, WorkoutSessionStatus, GroupClassStatus, MembershipStatus, PaymentMethod, PaymentStatus, EquipmentStatus } from '@prisma/client';
import { prisma } from '../src/config/client';
import bcrypt from 'bcrypt';

async function main() {
    console.log('🌱 Bắt đầu dọn dẹp dữ liệu cũ...');
    // Xóa theo thứ tự ràng buộc khóa ngoại để tránh lỗi Constraint
    await prisma.coachChangeRequest.deleteMany({});
    await prisma.exerciseLog.deleteMany({});
    await prisma.workoutSession.deleteMany({});
    await prisma.groupClass.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.coachAssignment.deleteMany({});
    await prisma.coachPtPackage.deleteMany({});
    await prisma.ptPackage.deleteMany({});
    await prisma.coachAvailability.deleteMany({});
    await prisma.coachProfile.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.plan.deleteMany({});
    await prisma.checkIn.deleteMany({});
    await prisma.equipment.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('🔑 Mã hóa mật khẩu cho dữ liệu mẫu...');
    const defaultPassword = 'GymManager@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    console.log('👤 Tạo tài khoản Quản trị & Nhân viên mẫu...');
    const admin = await prisma.user.create({
        data: {
            email: 'admin@gym.com',
            passwordHash,
            name: 'Quản Trị Viên Hệ Thống',
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            phone: '0900000001',
            gender: Gender.MALE,
            avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
        }
    });

    const staff1 = await prisma.user.create({
        data: {
            email: 'staff@gym.com',
            passwordHash,
            name: 'Nguyễn Lệ Quyên',
            role: UserRole.STAFF,
            status: UserStatus.ACTIVE,
            phone: '0900000002',
            gender: Gender.FEMALE,
            avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
        }
    });

    const staff2 = await prisma.user.create({
        data: {
            email: 'staff2@gym.com',
            passwordHash,
            name: 'Trần Quốc Huy',
            role: UserRole.STAFF,
            status: UserStatus.ACTIVE,
            phone: '0900000003',
            gender: Gender.MALE,
            avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150'
        }
    });

    console.log('👤 Tạo danh sách Huấn luyện viên mẫu (6 Coaches)...');
    const coachUsers = await Promise.all([
        prisma.user.create({
            data: {
                email: 'coach.nam@gym.com',
                passwordHash,
                name: 'Nguyễn Văn Nam',
                role: UserRole.COACH,
                status: UserStatus.ACTIVE,
                phone: '0911222333',
                gender: Gender.MALE,
                avatarUrl: 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=150'
            }
        }),
        prisma.user.create({
            data: {
                email: 'coach.huong@gym.com',
                passwordHash,
                name: 'Trần Thị Hương',
                role: UserRole.COACH,
                status: UserStatus.ACTIVE,
                phone: '0922333444',
                gender: Gender.FEMALE,
                avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
            }
        }),
        prisma.user.create({
            data: {
                email: 'coach.long@gym.com',
                passwordHash,
                name: 'Phạm Hoàng Long',
                role: UserRole.COACH,
                status: UserStatus.ACTIVE,
                phone: '0933444555',
                gender: Gender.MALE,
                avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
            }
        }),
        prisma.user.create({
            data: {
                email: 'coach.vy@gym.com',
                passwordHash,
                name: 'Lê Triệu Vy',
                role: UserRole.COACH,
                status: UserStatus.ACTIVE,
                phone: '0944555666',
                gender: Gender.FEMALE,
                avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
            }
        }),
        prisma.user.create({
            data: {
                email: 'coach.quan@gym.com',
                passwordHash,
                name: 'Đỗ Minh Quân',
                role: UserRole.COACH,
                status: UserStatus.ACTIVE,
                phone: '0955666777',
                gender: Gender.MALE,
                avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
            }
        }),
        prisma.user.create({
            data: {
                email: 'coach.linh@gym.com',
                passwordHash,
                name: 'Hoàng Ngọc Linh',
                role: UserRole.COACH,
                status: UserStatus.ACTIVE,
                phone: '0966777888',
                gender: Gender.FEMALE,
                avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
            }
        })
    ]);

    console.log('📋 Tạo hồ sơ chi tiết và lịch rảnh cho PT...');
    const coaches = await Promise.all([
        prisma.coachProfile.create({
            data: {
                userId: coachUsers[0]!.id,
                speciality: 'Tăng cơ, Giảm mỡ, HIIT',
                bio: '5 năm kinh nghiệm làm HLV cá nhân thể hình chuyên nghiệp. Đạt chứng chỉ Fitness Quốc Tế NASM.',
                isAvailable: true
            }
        }),
        prisma.coachProfile.create({
            data: {
                userId: coachUsers[1]!.id,
                speciality: 'Yoga bay, Dinh dưỡng chuyên sâu',
                bio: 'Chuyên gia tư vấn dinh dưỡng và HLV Yoga trị liệu tâm lý - vóc dáng.',
                isAvailable: true
            }
        }),
        prisma.coachProfile.create({
            data: {
                userId: coachUsers[2]!.id,
                speciality: 'Men Physique, Powerlifting',
                bio: 'Cựu vận động viên thể thao quốc gia. Chuyên đào tạo vận động viên thi đấu.',
                isAvailable: true
            }
        }),
        prisma.coachProfile.create({
            data: {
                userId: coachUsers[3]!.id,
                speciality: 'Pilates trị liệu, Phục hồi chấn thương',
                bio: 'Tốt nghiệp cử nhân Y Sinh học vận động. Đã giúp hơn 500 khách hàng phục hồi tư thế.',
                isAvailable: true
            }
        }),
        prisma.coachProfile.create({
            data: {
                userId: coachUsers[4]!.id,
                speciality: 'Calisthenics, Võ thuật Tự vệ',
                bio: 'HLV chuyên về các bài tập bodyweight nâng cao, rèn luyện sự dẻo dai và phản xạ tự vệ.',
                isAvailable: true
            }
        }),
        prisma.coachProfile.create({
            data: {
                userId: coachUsers[5]!.id,
                speciality: 'Zumba, Aerobics nhảy hiện đại',
                bio: 'Truyền cảm hứng tập luyện sôi động. Đạt chứng chỉ Zumba Core quốc tế.',
                isAvailable: true
            }
        })
    ]);

    // Thêm Lịch rảnh mẫu cho PT (Availabilities)
    for (const coach of coaches) {
        await prisma.coachAvailability.createMany({
            data: [
                { coachId: coach.id, dayOfWeek: 1, startTime: '08:00', endTime: '12:00', startMinutes: 480, endMinutes: 720 },
                { coachId: coach.id, dayOfWeek: 1, startTime: '14:00', endTime: '18:00', startMinutes: 840, endMinutes: 1080 },
                { coachId: coach.id, dayOfWeek: 3, startTime: '08:00', endTime: '12:00', startMinutes: 480, endMinutes: 720 },
                { coachId: coach.id, dayOfWeek: 4, startTime: '18:00', endTime: '21:00', startMinutes: 1080, endMinutes: 1260 },
                { coachId: coach.id, dayOfWeek: 5, startTime: '14:00', endTime: '20:00', startMinutes: 840, endMinutes: 1200 },
                { coachId: coach.id, dayOfWeek: 6, startTime: '09:00', endTime: '16:00', startMinutes: 540, endMinutes: 960 }
            ]
        });
    }

    console.log('👤 Tạo danh sách Hội viên mẫu (45 Members)...');
    const memberData = [
        { name: 'Trần Văn An', email: 'member.an@gmail.com', phone: '0988777666', gender: Gender.MALE },
        { name: 'Lê Thị Bình', email: 'member.binh@gmail.com', phone: '0977666555', gender: Gender.FEMALE },
        { name: 'Nguyễn Mạnh Cường', email: 'member.cuong@gmail.com', phone: '0966555444', gender: Gender.MALE },
        { name: 'Hoàng Đăng Khoa', email: 'member.khoa@gmail.com', phone: '0955444333', gender: Gender.MALE },
        { name: 'Vũ Thùy Chi', email: 'member.chi@gmail.com', phone: '0944333222', gender: Gender.FEMALE },
        { name: 'Phạm Minh Đức', email: 'member.duc@gmail.com', phone: '0933222111', gender: Gender.MALE },
        { name: 'Đặng Bảo Ngọc', email: 'member.ngoc@gmail.com', phone: '0922111000', gender: Gender.FEMALE },
        { name: 'Bùi Anh Tuấn', email: 'member.tuan@gmail.com', phone: '0911000999', gender: Gender.MALE },
        { name: 'Đỗ Hải Yến', email: 'member.yen@gmail.com', phone: '0909999888', gender: Gender.FEMALE },
        { name: 'Ngô Quốc Khánh', email: 'member.khanh@gmail.com', phone: '0908888777', gender: Gender.MALE },
        { name: 'Trịnh Linh Đan', email: 'member.dan@gmail.com', phone: '0907777666', gender: Gender.FEMALE },
        { name: 'Phan Văn Hải', email: 'member.hai@gmail.com', phone: '0906666555', gender: Gender.MALE },
        { name: 'Mai Phương Thảo', email: 'member.thao@gmail.com', phone: '0905555444', gender: Gender.FEMALE },
        { name: 'Dương Quốc Bảo', email: 'member.bao@gmail.com', phone: '0904444333', gender: Gender.MALE },
        { name: 'Nguyễn Thùy Trang', email: 'member.trang@gmail.com', phone: '0903333222', gender: Gender.FEMALE },
        { name: 'Vũ Hoàng Anh', email: 'member.hoanganh@gmail.com', phone: '0902222111', gender: Gender.MALE },
        { name: 'Phạm Thanh Sơn', email: 'member.son@gmail.com', phone: '0901111000', gender: Gender.MALE },
        { name: 'Lê Hữu Phước', email: 'member.phuoc@gmail.com', phone: '0912345678', gender: Gender.MALE },
        { name: 'Trần Ngọc Trâm', email: 'member.tram@gmail.com', phone: '0913456789', gender: Gender.FEMALE },
        { name: 'Đỗ Hoàng Giang', email: 'member.giang@gmail.com', phone: '0914567890', gender: Gender.MALE },
        { name: 'Nguyễn Minh Nhật', email: 'member.nhat@gmail.com', phone: '0915678901', gender: Gender.MALE },
        { name: 'Hoàng Thanh Hằng', email: 'member.hang@gmail.com', phone: '0916789012', gender: Gender.FEMALE },
        { name: 'Phan Huy Hoàng', email: 'member.hoang@gmail.com', phone: '0917890123', gender: Gender.MALE },
        { name: 'Bùi Thị Tuyết', email: 'member.tuyet@gmail.com', phone: '0918901234', gender: Gender.FEMALE },
        { name: 'Dương Văn Lâm', email: 'member.lam@gmail.com', phone: '0919012345', gender: Gender.MALE },
        { name: 'Nguyễn Phương Nam', email: 'member.pnam@gmail.com', phone: '0920123456', gender: Gender.MALE },
        { name: 'Đặng Tiến Đạt', email: 'member.dat@gmail.com', phone: '0921234567', gender: Gender.MALE },
        { name: 'Vũ Kim Ngân', email: 'member.ngan@gmail.com', phone: '0922345678', gender: Gender.FEMALE },
        { name: 'Phạm Tuấn Kiệt', email: 'member.kiet@gmail.com', phone: '0923456789', gender: Gender.MALE },
        { name: 'Trịnh Công Vinh', email: 'member.vinh@gmail.com', phone: '0924567890', gender: Gender.MALE },
        { name: 'Lê Thu Hà', email: 'member.ha@gmail.com', phone: '0925678901', gender: Gender.FEMALE },
        { name: 'Trần Minh Quân', email: 'member.mquan@gmail.com', phone: '0926789012', gender: Gender.MALE },
        { name: 'Nguyễn Diệu Linh', email: 'member.dlinh@gmail.com', phone: '0927890123', gender: Gender.FEMALE },
        { name: 'Võ Hoài Nam', email: 'member.hnam@gmail.com', phone: '0928901234', gender: Gender.MALE },
        { name: 'Ngô Bảo Châu', email: 'member.chau@gmail.com', phone: '0929012345', gender: Gender.MALE },
        { name: 'Đỗ Ngọc Sơn', email: 'member.oson@gmail.com', phone: '0930123456', gender: Gender.MALE },
        { name: 'Hoàng Khánh Vy', email: 'member.kvy@gmail.com', phone: '0931234567', gender: Gender.FEMALE },
        { name: 'Phan Minh Tuấn', email: 'member.mtuan@gmail.com', phone: '0932345678', gender: Gender.MALE },
        { name: 'Nguyễn Thùy Linh', email: 'member.tlinh@gmail.com', phone: '0933456789', gender: Gender.FEMALE },
        { name: 'Lê Anh Dũng', email: 'member.dung@gmail.com', phone: '0934567890', gender: Gender.MALE },
        { name: 'Đặng Thảo Nguyên', email: 'member.nguyen@gmail.com', phone: '0935678901', gender: Gender.FEMALE },
        { name: 'Vũ Hữu Đạt', email: 'member.hdat@gmail.com', phone: '0936789012', gender: Gender.MALE },
        { name: 'Trần Cẩm Ly', email: 'member.ly@gmail.com', phone: '0937890123', gender: Gender.FEMALE },
        { name: 'Phạm Thế Vinh', email: 'member.tvinh@gmail.com', phone: '0938901234', gender: Gender.MALE },
        { name: 'Nguyễn Bích Thủy', email: 'member.thuy@gmail.com', phone: '0939012345', gender: Gender.FEMALE }
    ];

    const now = new Date();

    const members = await Promise.all(
        memberData.map((m, idx) => prisma.user.create({
            data: {
                email: m.email,
                passwordHash,
                name: m.name,
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                phone: m.phone,
                gender: m.gender,
                // Tạo ngẫu nhiên ngày đăng ký trong vòng 120 ngày qua để phân bổ doanh thu/hội viên
                createdAt: new Date(now.getTime() - (idx * 2 + Math.random() * 2) * 24 * 60 * 60 * 1000)
            }
        }))
    );

    console.log('📋 Tạo các Gói tập Gym thường mẫu...');
    const plans = await Promise.all([
        prisma.plan.create({
            data: {
                code: 'GYM_1M',
                name: 'Gói tập 1 tháng cơ bản',
                description: 'Tự do tập luyện trong 30 ngày',
                price: 500000.00,
                duration_days: 30,
                features: ["Sử dụng đầy đủ trang thiết bị", "Miễn phí tủ đồ cá nhân"]
            }
        }),
        prisma.plan.create({
            data: {
                code: 'GYM_3M',
                name: 'Gói tập 3 tháng tiết kiệm',
                description: 'Tự do tập luyện trong 90 ngày',
                price: 1200000.00,
                duration_days: 90,
                features: ["Sử dụng đầy đủ trang thiết bị", "Miễn phí tủ đồ cá nhân", "Được bảo lưu thẻ 15 ngày"]
            }
        }),
        prisma.plan.create({
            data: {
                code: 'GYM_6M',
                name: 'Gói tập 6 tháng tiêu chuẩn',
                description: 'Tự do tập luyện trong 180 ngày',
                price: 2200000.00,
                duration_days: 180,
                features: ["Sử dụng đầy đủ trang thiết bị", "Miễn phí tủ đồ cá nhân", "Được bảo lưu thẻ 30 ngày", "Tặng 1 buổi định hướng tập luyện"]
            }
        }),
        prisma.plan.create({
            data: {
                code: 'GYM_12M',
                name: 'Gói tập 12 tháng VIP',
                description: 'Tự do tập luyện trong 365 ngày',
                price: 4000000.00,
                duration_days: 365,
                features: ["Quyền lợi VIP", "Sử dụng đầy đủ trang thiết bị", "Miễn phí tủ đồ + khăn tắm", "Được bảo lưu thẻ 45 ngày", "Giảm 10% khi thuê PT"]
            }
        })
    ]);

    console.log('📋 Tạo các gói Membership kích hoạt cho hội viên...');
    const memberships: any[] = [];
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Phân bổ ngẫu nhiên membership cho 45 hội viên với các trạng thái khác nhau
    // - 28 Active
    // - 4 Upgraded
    // - 6 Expired
    // - 5 Cancelled
    // - 2 Pending
    for (let i = 0; i < members.length; i++) {
        let status: MembershipStatus = MembershipStatus.ACTIVE;
        let isActive = true;
        let start_date = new Date();
        let end_date = new Date();
        const plan = plans[i % plans.length]!;

        if (i < 28) {
            // Active
            status = MembershipStatus.ACTIVE;
            isActive = true;
            start_date = new Date(currentYear, currentMonth, 1 - i);
            end_date = new Date(start_date.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
        } else if (i < 32) {
            // Upgraded
            status = MembershipStatus.UPGRADED;
            isActive = false;
            start_date = new Date(currentYear, currentMonth - 2, 1);
            end_date = new Date(currentYear, currentMonth - 1, 1);
        } else if (i < 38) {
            // Expired
            status = MembershipStatus.EXPIRED;
            isActive = false;
            start_date = new Date(currentYear, currentMonth - 4, 1);
            end_date = new Date(currentYear, currentMonth - 1, 1);
        } else if (i < 43) {
            // Cancelled
            status = MembershipStatus.CANCELLED;
            isActive = false;
            start_date = new Date(currentYear, currentMonth - 1, 15);
            end_date = new Date(currentYear, currentMonth + 1, 15);
        } else {
            // Pending
            status = MembershipStatus.PENDING;
            isActive = false;
            start_date = new Date(currentYear, currentMonth + 1, 1);
            end_date = new Date(currentYear, currentMonth + 2, 1);
        }

        const m = await prisma.membership.create({
            data: {
                user_id: members[i]!.id,
                plan_id: plan.id,
                start_date,
                end_date,
                status,
                is_active: isActive
            }
        });
        memberships.push(m);
    }

    console.log('📦 Tạo các Gói Combo PT mẫu...');
    const package1 = await prisma.ptPackage.create({
        data: {
            code: 'PT_WEIGHT_12S',
            name: 'Combo 12 buổi - Giảm mỡ nhanh cùng PT',
            numberOfSessions: 12,
            durationDays: 30,
            goal: TrainingGoal.WEIGHT_LOSS
        }
    });

    const package2 = await prisma.ptPackage.create({
        data: {
            code: 'PT_MUSCLE_24S',
            name: 'Combo 24 buổi - Tăng cơ chuyên sâu cùng PT',
            numberOfSessions: 24,
            durationDays: 60,
            goal: TrainingGoal.MUSCLE_GAIN
        }
    });

    const package3 = await prisma.ptPackage.create({
        data: {
            code: 'PT_COMP_36S',
            name: 'Combo 36 buổi - Huấn luyện thi đấu chuyên nghiệp',
            numberOfSessions: 36,
            durationDays: 90,
            goal: TrainingGoal.COMPETITION_PREP
        }
    });

    console.log('💵 Khai báo giá bán riêng của từng PT đối với từng Combo...');
    await prisma.coachPtPackage.createMany({
        data: [
            { coachId: coaches[0]!.id, ptPackageId: package1.id, price: 4000000.00 },
            { coachId: coaches[0]!.id, ptPackageId: package2.id, price: 7500000.00 },
            { coachId: coaches[1]!.id, ptPackageId: package1.id, price: 4500000.00 },
            { coachId: coaches[1]!.id, ptPackageId: package2.id, price: 8000000.00 },
            { coachId: coaches[2]!.id, ptPackageId: package2.id, price: 9000000.00 },
            { coachId: coaches[2]!.id, ptPackageId: package3.id, price: 18000000.00 },
            { coachId: coaches[3]!.id, ptPackageId: package1.id, price: 4200000.00 },
            { coachId: coaches[3]!.id, ptPackageId: package2.id, price: 7800000.00 },
            { coachId: coaches[4]!.id, ptPackageId: package2.id, price: 8200000.00 },
            { coachId: coaches[5]!.id, ptPackageId: package1.id, price: 4800000.00 }
        ]
    });

    console.log('💳 Tạo hợp đồng thuê PT (Coach Assignments) mẫu...');
    const assignments: any[] = [];
    const assignmentConfigs = [
        // Coach 1: 5 active slots
        { coach: coaches[0]!, user: members[0]!, pkg: package1, price: 4000000.00 },
        { coach: coaches[0]!, user: members[1]!, pkg: package1, price: 4000000.00 },
        { coach: coaches[0]!, user: members[2]!, pkg: package2, price: 7500000.00 },
        { coach: coaches[0]!, user: members[3]!, pkg: package1, price: 4000000.00 },
        { coach: coaches[0]!, user: members[4]!, pkg: package2, price: 7500000.00 },

        // Coach 2: 4 active slots
        { coach: coaches[1]!, user: members[5]!, pkg: package1, price: 4500000.00 },
        { coach: coaches[1]!, user: members[6]!, pkg: package1, price: 4500000.00 },
        { coach: coaches[1]!, user: members[7]!, pkg: package2, price: 8000000.00 },
        { coach: coaches[1]!, user: members[8]!, pkg: package1, price: 4500000.00 },

        // Coach 3: 3 active slots
        { coach: coaches[2]!, user: members[9]!, pkg: package2, price: 9000000.00 },
        { coach: coaches[2]!, user: members[10]!, pkg: package3, price: 18000000.00 },
        { coach: coaches[2]!, user: members[11]!, pkg: package2, price: 9000000.00 },

        // Coach 4: 3 active slots
        { coach: coaches[3]!, user: members[12]!, pkg: package1, price: 4200000.00 },
        { coach: coaches[3]!, user: members[13]!, pkg: package2, price: 7800000.00 },
        { coach: coaches[3]!, user: members[14]!, pkg: package1, price: 4200000.00 },

        // Coach 5: 2 active slots
        { coach: coaches[4]!, user: members[15]!, pkg: package2, price: 8200000.00 },
        { coach: coaches[4]!, user: members[16]!, pkg: package2, price: 8200000.00 },

        // Coach 6: 2 active slots
        { coach: coaches[5]!, user: members[17]!, pkg: package1, price: 4800000.00 },
        { coach: coaches[5]!, user: members[18]!, pkg: package1, price: 4800000.00 }
    ];

    for (const config of assignmentConfigs) {
        const assign = await prisma.coachAssignment.create({
            data: {
                coachId: config.coach.id,
                userId: config.user.id,
                ptPackageId: config.pkg.id,
                totalSessions: config.pkg.numberOfSessions,
                remainingSessions: Math.floor(Math.random() * config.pkg.numberOfSessions),
                pricePaid: config.price,
                startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
                endDate: new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000),
                status: 'ACTIVE'
            }
        });
        assignments.push(assign);
    }

    console.log('💵 Tạo lịch sử hóa đơn thanh toán chéo (Doanh thu đa năm & đa tháng)...');

    // 1. Dữ liệu doanh thu các năm trước (currentYear-4 đến currentYear-1) để vẽ biểu đồ Năm
    const historicalYears = [currentYear - 4, currentYear - 3, currentYear - 2, currentYear - 1];
    const historicalRevenues = [48000000, 72000000, 135000000, 260000000];

    for (let idx = 0; idx < historicalYears.length; idx++) {
        const year = historicalYears[idx]!;
        const totalRev = historicalRevenues[idx]!;
        // Chia nhỏ doanh thu thành nhiều thanh toán nhỏ lẻ
        let currentRevSum = 0;
        let count = 0;
        while (currentRevSum < totalRev) {
            const plan = plans[count % plans.length]!;
            const amount = plan.price.toNumber();
            const payDate = new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
            const randUser = members[count % members.length]!;

            await prisma.payment.create({
                data: {
                    user_id: randUser.id,
                    plan_id: plan.id,
                    amount,
                    method: PaymentMethod.BANK_TRANSFER,
                    status: PaymentStatus.PAID,
                    transaction_ref: 'HST' + year + Math.floor(Math.random() * 1000000),
                    paid_at: payDate,
                    created_at: payDate
                }
            });
            currentRevSum += amount;
            count++;
        }
    }

    // 2. Dữ liệu doanh thu 12 tháng trong năm hiện tại (vẽ biểu đồ Tháng)
    // Đường cong doanh thu phát triển tăng dần qua các tháng
    const targetMonthlyRevenues = [
        28000000, // Th 1
        32000000, // Th 2
        36000000, // Th 3
        42000000, // Th 4
        48000000, // Th 5
        58000000, // Th 6 (Tháng hiện tại - đỉnh)
        35000000, // Th 7 (Mock đầy đủ)
        38000000, // Th 8
        44000000, // Th 9
        50000000, // Th 10
        62000000, // Th 11
        74000000  // Th 12
    ];

    for (let month = 0; month < 12; month++) {
        const targetRev = targetMonthlyRevenues[month]!;
        let currentRevSum = 0;
        let count = 0;

        while (currentRevSum < targetRev) {
            const isPT = Math.random() > 0.6; // 40% doanh thu từ HLV cá nhân
            const assignment = assignments[count % assignments.length]!;
            const plan = plans[count % plans.length]!;
            const amount = isPT 
                ? (assignment.pricePaid.toNumber() / 2) // PT thanh toán từng đợt
                : plan.price.toNumber();
            
            const randUser = members[(month * 3 + count) % members.length]!;
            const payDate = new Date(currentYear, month, Math.floor(Math.random() * 28) + 1);

            await prisma.payment.create({
                data: {
                    user_id: randUser.id,
                    plan_id: isPT ? null : plan.id,
                    coach_assignment_id: isPT ? assignment.id : null,
                    amount,
                    method: PaymentMethod.VNPAY,
                    status: PaymentStatus.PAID,
                    transaction_ref: 'MTH' + currentYear + 'M' + month + 'N' + Math.floor(Math.random() * 100000),
                    paid_at: payDate,
                    created_at: payDate
                }
            });
            currentRevSum += amount;
            count++;
        }
    }

    // 3. Tạo một số giao dịch thất bại và chờ thanh toán trong tuần qua để hiển thị trạng thái thực tế
    const recentFailedPending = [
        { user: members[25]!, amount: 500000.00, plan: plans[0]!, status: PaymentStatus.FAILED },
        { user: members[26]!, amount: 1200000.00, plan: plans[1]!, status: PaymentStatus.PENDING },
        { user: members[27]!, amount: 4000000.00, plan: plans[3]!, status: PaymentStatus.FAILED },
        { user: members[28]!, amount: 2200000.00, plan: plans[2]!, status: PaymentStatus.PENDING }
    ];

    for (const item of recentFailedPending) {
        const payDate = new Date(now.getTime() - Math.random() * 3 * 24 * 60 * 60 * 1000);
        await prisma.payment.create({
            data: {
                user_id: item.user.id,
                plan_id: item.plan.id,
                amount: item.amount,
                method: PaymentMethod.MOMO,
                status: item.status,
                created_at: payDate
            }
        });
    }

    // 4. Tạo hóa đơn trong 7 ngày gần đây để biểu đồ Tuần ('W') có dữ liệu phong phú
    // Mỗi ngày tạo từ 1 đến 3 hóa đơn thành công
    const dailyTargetAmounts = [
        2500000.00, // 6 ngày trước
        4000000.00, // 5 ngày trước
        1500000.00, // 4 ngày trước
        6200000.00, // 3 ngày trước
        3500000.00, // 2 ngày trước
        8000000.00, // 1 ngày trước (hôm qua)
        5500000.00  // Hôm nay (0 ngày trước)
    ];

    for (let i = 6; i >= 0; i--) {
        const targetAmt = dailyTargetAmounts[6 - i]!;
        const payDate = new Date();
        payDate.setDate(now.getDate() - i);
        
        let daySum = 0;
        let count = 0;
        while (daySum < targetAmt) {
            const plan = plans[count % plans.length]!;
            const randUser = members[(i * 4 + count) % members.length]!;
            
            await prisma.payment.create({
                data: {
                    user_id: randUser.id,
                    plan_id: plan.id,
                    amount: plan.price,
                    method: PaymentMethod.BANK_TRANSFER,
                    status: PaymentStatus.PAID,
                    transaction_ref: 'DAY' + i + 'N' + Math.floor(Math.random() * 100000),
                    paid_at: payDate,
                    created_at: payDate
                }
            });
            daySum += plan.price.toNumber();
            count++;
        }
    }

    console.log('🔩 Tạo dữ liệu thiết bị (16 Gym Equipments)...');
    const equipmentsData = [
        { name: 'Máy chạy bộ Impulse RT500', code: 'EQ-RUN-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu Cardio' },
        { name: 'Máy chạy bộ Impulse RT500', code: 'EQ-RUN-02', status: EquipmentStatus.OPERATIONAL, location: 'Khu Cardio' },
        { name: 'Máy chạy bộ Technogym Skillrun', code: 'EQ-RUN-03', status: EquipmentStatus.UNDER_MAINTENANCE, location: 'Khu Cardio', note: 'Lỗi cảm biến nhịp tim - Đang kiểm tra' },
        { name: 'Máy chạy bộ Matrix T70', code: 'EQ-RUN-04', status: EquipmentStatus.OUT_OF_SERVICE, location: 'Khu Cardio', note: 'Lỗi trượt băng tải - Chờ linh kiện thay thế' },
        { name: 'Xe đạp trượt tuyết Elliptical BH Fitness', code: 'EQ-CYC-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu Cardio' },
        { name: 'Xe đạp tập Impulse DUO', code: 'EQ-CYC-02', status: EquipmentStatus.OPERATIONAL, location: 'Khu Cardio' },
        { name: 'Máy chèo thuyền WaterRower', code: 'EQ-ROW-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu Cardio' },
        { name: 'Khung gánh tạ Squat Rack DHZ', code: 'EQ-SQU-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu FreeWeight' },
        { name: 'Khung gánh tạ Smith Machine Matrix', code: 'EQ-SQU-02', status: EquipmentStatus.OPERATIONAL, location: 'Khu FreeWeight' },
        { name: 'Máy đạp đùi Leg Press Matrix', code: 'EQ-LEG-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu máy khối' },
        { name: 'Máy đùi sau Leg Curl DHZ', code: 'EQ-LEG-02', status: EquipmentStatus.UNDER_MAINTENANCE, location: 'Khu máy khối', note: 'Đứt dây cáp lực kéo - Đang sửa chữa' },
        { name: 'Dàn tạ đĩa 500kg Iron Bull', code: 'EQ-FWE-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu FreeWeight' },
        { name: 'Dàn tạ tay Dumbbells 5kg - 40kg', code: 'EQ-FWE-02', status: EquipmentStatus.OPERATIONAL, location: 'Khu FreeWeight' },
        { name: 'Ghế tập ngực ngang Bench Press', code: 'EQ-FWE-03', status: EquipmentStatus.OPERATIONAL, location: 'Khu FreeWeight' },
        { name: 'Ghế tập ngực dốc lên Incline Bench', code: 'EQ-FWE-04', status: EquipmentStatus.OUT_OF_SERVICE, location: 'Khu FreeWeight', note: 'Hỏng chốt điều chỉnh độ dốc ghế' },
        { name: 'Máy ép ngực Pec Fly / Rear Delt Matrix', code: 'EQ-PEC-01', status: EquipmentStatus.OPERATIONAL, location: 'Khu máy khối' }
    ];

    await prisma.equipment.createMany({
        data: equipmentsData
    });

    console.log('📍 Tạo dữ liệu điểm danh quét mã CheckIn (60 lượt)...');
    // Điểm danh rải rác trong 5 ngày qua
    for (let i = 0; i < 60; i++) {
        const checkInAt = new Date();
        // Một số checkin rất mới (5 phút, 15 phút trước) để log đẹp mắt
        if (i === 0) checkInAt.setMinutes(now.getMinutes() - 5);
        else if (i === 1) checkInAt.setMinutes(now.getMinutes() - 15);
        else if (i === 2) checkInAt.setMinutes(now.getMinutes() - 32);
        else if (i === 3) checkInAt.setMinutes(now.getMinutes() - 58);
        else if (i === 4) checkInAt.setHours(now.getHours() - 2);
        else if (i === 5) checkInAt.setHours(now.getHours() - 4);
        else {
            checkInAt.setDate(now.getDate() - Math.floor(Math.random() * 5));
            checkInAt.setHours(Math.floor(Math.random() * 15) + 6, Math.floor(Math.random() * 60)); // Thời gian mở cửa 6h - 21h
        }

        await prisma.checkIn.create({
            data: {
                userId: members[i % members.length]!.id,
                checkInAt
            }
        });
    }

    console.log('📅 Tạo lịch hẹn tập & Giáo án tập luyện chi tiết...');
    // Tạo 15 buổi đã tập xong trong quá khứ kèm theo nhật ký bài tập
    for (let i = 0; i < 15; i++) {
        const scheduledAt = new Date();
        scheduledAt.setDate(now.getDate() - (i + 1));
        scheduledAt.setHours(9 + (i % 8), 0, 0, 0);

        const session = await prisma.workoutSession.create({
            data: {
                userId: members[i % 15]!.id,
                coachId: coaches[i % coaches.length]!.id,
                scheduledAt,
                durationMinutes: 60,
                status: WorkoutSessionStatus.COMPLETED,
                note: 'Hội viên hoàn thành giáo án tốt, lực đẩy cải thiện tốt.'
            }
        });

        // Tạo 2 bài tập chi tiết cho mỗi buổi tập
        await prisma.exerciseLog.createMany({
            data: [
                { sessionId: session.id, exerciseName: 'Barbell Bench Press', sets: 4, reps: 10, weightKg: 60, restSeconds: 90, note: 'Tăng tạ hiệp cuối' },
                { sessionId: session.id, exerciseName: 'Dumbbell Flyes', sets: 3, reps: 12, weightKg: 15, restSeconds: 60 }
            ]
        });
    }

    // Tạo 8 buổi tập được lập lịch trong 3 ngày tới
    for (let i = 0; i < 8; i++) {
        const scheduledAt = new Date();
        scheduledAt.setDate(now.getDate() + (i % 3) + 1);
        scheduledAt.setHours(8 + (i * 2 % 10), 0, 0, 0);

        await prisma.workoutSession.create({
            data: {
                userId: members[(i + 10) % members.length]!.id,
                coachId: coaches[i % coaches.length]!.id,
                scheduledAt,
                durationMinutes: 60,
                status: WorkoutSessionStatus.PLANNED,
                note: 'Trọng tâm tập trung vào đùi trước và cơ bụng.'
            }
        });
    }

    console.log('🏛️ Tạo các lớp học nhóm (Group Classes) do PT dạy...');
    const classNames = [
        'Lớp Yoga Trị Liệu & Giãn Cơ Căn Bản',
        'Lớp Zumba Dance Đốt Calories Siêu Tốc',
        'Lớp CrossFit Sức Mạnh Bộc Phát',
        'Lớp Pilates Định Hình Vóc Dáng'
    ];

    for (let i = 0; i < classNames.length; i++) {
        const scheduledAt = new Date();
        scheduledAt.setDate(now.getDate() + 1 + (i % 2));
        scheduledAt.setHours(8 + (i * 2), 30, 0, 0);

        await prisma.groupClass.create({
            data: {
                coachId: coaches[i % coaches.length]!.id,
                name: classNames[i]!,
                scheduledAt,
                durationMinutes: 60,
                status: GroupClassStatus.SCHEDULED
            }
        });
    }

    console.log('🎉 Gieo hạt (Seeding) dữ liệu hoàn tất thành công!');
    console.log('🌟 --- THÔNG TIN ĐĂNG NHẬP MẪU --- 🌟');
    console.log('Mật khẩu chung cho tất cả tài khoản: GymManager@123');
    console.log('1. Admin: admin@gym.com');
    console.log('2. Staff: staff@gym.com');
    console.log('3. Staff 2: staff2@gym.com');
    console.log('4. PT Nguyễn Văn Nam: coach.nam@gym.com');
    console.log('5. PT Trần Thị Hương: coach.huong@gym.com');
    console.log('6. Hội viên Trần Văn An: member.an@gmail.com');
    console.log('7. Hội viên Lê Thị Bình: member.binh@gmail.com');
}

main()
    .catch((e) => {
        console.error('❌ Lỗi gieo hạt dữ liệu:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
