import 'dotenv/config';
import { UserRole, UserStatus, Gender, TrainingGoal, WorkoutSessionStatus, GroupClassStatus } from '@prisma/client';
import { prisma } from '../src/config/client';
import bcrypt from 'bcrypt';

async function main() {
    console.log('🌱 Bắt đầu dọn dẹp dữ liệu cũ...');
    // Xóa theo thứ tự ràng buộc khóa ngoại
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
    await prisma.user.deleteMany({});

    console.log('🔑 Mã hóa mật khẩu cho dữ liệu mẫu...');
    const defaultPassword = 'GymManager@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    console.log('👤 Tạo tài khoản người dùng mẫu...');
    // 1. Tạo Admin
    const admin = await prisma.user.create({
        data: {
            email: 'admin@gym.com',
            passwordHash,
            name: 'Quản Trị Viên Hệ Thống',
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            phone: '0900000001'
        }
    });

    // 2. Tạo PTs (Coaches)
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
                avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'
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
                avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'
            }
        })
    ]);

    // 3. Tạo Hội viên (Members)
    const members = await Promise.all([
        prisma.user.create({
            data: {
                email: 'member.an@gmail.com',
                passwordHash,
                name: 'Trần Văn An',
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                phone: '0988777666',
                gender: Gender.MALE
            }
        }),
        prisma.user.create({
            data: {
                email: 'member.binh@gmail.com',
                passwordHash,
                name: 'Lê Thị Bình',
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                phone: '0977666555',
                gender: Gender.FEMALE
            }
        }),
        prisma.user.create({
            data: {
                email: 'member.cuong@gmail.com',
                passwordHash,
                name: 'Nguyễn Mạnh Cường',
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
                phone: '0966555444',
                gender: Gender.MALE
            }
        })
    ]);

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
                code: 'GYM_12M',
                name: 'Gói tập 12 tháng VIP',
                description: 'Tự do tập luyện trong 365 ngày',
                price: 4000000.00,
                duration_days: 365,
                features: ["Quyền lợi VIP", "Sử dụng đầy đủ trang thiết bị", "Miễn phí tủ đồ + khăn tắm", "Được bảo lưu thẻ 45 ngày"]
            }
        })
    ]);

    console.log('📋 Tạo hồ sơ PT & Lịch làm việc rảnh mẫu...');
    const coach1 = await prisma.coachProfile.create({
        data: {
            userId: coachUsers[0].id,
            speciality: 'Tăng cơ, Giảm mỡ, Luyện tập cường độ cao (HIIT)',
            bio: '5 năm kinh nghiệm làm HLV cá nhân thể hình chuyên nghiệp. Đạt chứng chỉ Fitness Quốc Tế NASM.',
            isAvailable: true
        }
    });

    const coach2 = await prisma.coachProfile.create({
        data: {
            userId: coachUsers[1].id,
            speciality: 'Giảm cân nhanh, Yoga bay, Dinh dưỡng chuyên sâu',
            bio: 'Chuyên gia tư vấn dinh dưỡng và HLV Yoga trị liệu tâm lý - vóc dáng.',
            isAvailable: true
        }
    });

    const coach3 = await prisma.coachProfile.create({
        data: {
            userId: coachUsers[2].id,
            speciality: 'Huấn luyện thi đấu Men Physique, Powerlifting',
            bio: 'Cựu vận động viên thể thao quốc gia. Chuyên đào tạo vận động viên thi đấu.',
            isAvailable: true
        }
    });

    const coach4 = await prisma.coachProfile.create({
        data: {
            userId: coachUsers[3].id,
            speciality: 'Phục hồi chấn thương sau phẫu thuật, Pilates trị liệu',
            bio: 'Tốt nghiệp cử nhân Y Sinh học vận động. Đã giúp hơn 500 khách hàng phục hồi tư thế.',
            isAvailable: false // Khởi tạo PT này tạm ngưng hoạt động để test API
        }
    });

    // Thêm Lịch rảnh mẫu (Availabilities) cho PT
    // Nguyễn Văn Nam (coach1): Rảnh Thứ 2, 4, 6 (08:00 - 12:00 và 14:00 - 18:00)
    await prisma.coachAvailability.createMany({
        data: [
            { coachId: coach1.id, dayOfWeek: 1, startTime: '08:00', endTime: '12:00', startMinutes: 480, endMinutes: 720 },
            { coachId: coach1.id, dayOfWeek: 1, startTime: '14:00', endTime: '18:00', startMinutes: 840, endMinutes: 1080 },
            { coachId: coach1.id, dayOfWeek: 3, startTime: '08:00', endTime: '12:00', startMinutes: 480, endMinutes: 720 },
            { coachId: coach1.id, dayOfWeek: 3, startTime: '14:00', endTime: '18:00', startMinutes: 840, endMinutes: 1080 },
            { coachId: coach1.id, dayOfWeek: 5, startTime: '08:00', endTime: '12:00', startMinutes: 480, endMinutes: 720 },
            { coachId: coach1.id, dayOfWeek: 5, startTime: '14:00', endTime: '18:00', startMinutes: 840, endMinutes: 1080 }
        ]
    });

    // Trần Thị Hương (coach2): Rảnh Thứ 3, 5 (08:00 - 11:00 và 18:00 - 21:00)
    await prisma.coachAvailability.createMany({
        data: [
            { coachId: coach2.id, dayOfWeek: 2, startTime: '08:00', endTime: '11:00', startMinutes: 480, endMinutes: 660 },
            { coachId: coach2.id, dayOfWeek: 2, startTime: '18:00', endTime: '21:00', startMinutes: 1080, endMinutes: 1260 },
            { coachId: coach2.id, dayOfWeek: 4, startTime: '08:00', endTime: '11:00', startMinutes: 480, endMinutes: 660 },
            { coachId: coach2.id, dayOfWeek: 4, startTime: '18:00', endTime: '21:00', startMinutes: 1080, endMinutes: 1260 }
        ]
    });

    // Phạm Hoàng Long (coach3): Rảnh Thứ 2, 4, 6 (14:00 - 21:00)
    await prisma.coachAvailability.createMany({
        data: [
            { coachId: coach3.id, dayOfWeek: 1, startTime: '14:00', endTime: '21:00', startMinutes: 840, endMinutes: 1260 },
            { coachId: coach3.id, dayOfWeek: 3, startTime: '14:00', endTime: '21:00', startMinutes: 840, endMinutes: 1260 },
            { coachId: coach3.id, dayOfWeek: 5, startTime: '14:00', endTime: '21:00', startMinutes: 840, endMinutes: 1260 }
        ]
    });

    // Lê Triệu Vy (coach4): Rảnh Thứ 3, 5, 7 (09:00 - 17:00)
    await prisma.coachAvailability.createMany({
        data: [
            { coachId: coach4.id, dayOfWeek: 2, startTime: '09:00', endTime: '17:00', startMinutes: 540, endMinutes: 1020 },
            { coachId: coach4.id, dayOfWeek: 4, startTime: '09:00', endTime: '17:00', startMinutes: 540, endMinutes: 1020 },
            { coachId: coach4.id, dayOfWeek: 6, startTime: '09:00', endTime: '17:00', startMinutes: 540, endMinutes: 1020 }
        ]
    });

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

    const package4 = await prisma.ptPackage.create({
        data: {
            code: 'PT_REHAB_12S',
            name: 'Combo 12 buổi - Phục hồi chấn thương & Thể chất',
            numberOfSessions: 12,
            durationDays: 45,
            goal: TrainingGoal.REHABILITATION,
            isActive: false // Khởi tạo gói này bị khóa để test API
        }
    });

    console.log('💵 Khai báo mức giá riêng của từng PT đối với từng Combo...');
    await prisma.coachPtPackage.createMany({
        data: [
            // Nguyễn Văn Nam dạy giảm cân (4tr) và tăng cơ (7.5tr)
            { coachId: coach1.id, ptPackageId: package1.id, price: 4000000.00 },
            { coachId: coach1.id, ptPackageId: package2.id, price: 7500000.00 },
            // Trần Thị Hương dạy giảm cân (4.5tr)
            { coachId: coach2.id, ptPackageId: package1.id, price: 4500000.00 },
            // Phạm Hoàng Long dạy tăng cơ (9tr) và thi đấu (18tr)
            { coachId: coach3.id, ptPackageId: package2.id, price: 9000000.00 },
            { coachId: coach3.id, ptPackageId: package3.id, price: 18000000.00 },
            // Lê Triệu Vy dạy phục hồi (6tr)
            { coachId: coach4.id, ptPackageId: package4.id, price: 6000000.00 },
            // Trần Thị Hương dạy tăng cơ nhưng đã bị khóa hoạt động liên kết này
            { coachId: coach2.id, ptPackageId: package2.id, price: 8000000.00, isActive: false }
        ]
    });

    console.log('💳 Tạo hợp đồng thuê PT & Thanh toán thành công mẫu...');
    // Trần Văn An (members[0]) thuê Nguyễn Văn Nam (coach1) gói 12 buổi Giảm Mỡ
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 30); // 30 ngày hạn dùng

    const assignment1 = await prisma.coachAssignment.create({
        data: {
            coachId: coach1.id,
            userId: members[0].id,
            ptPackageId: package1.id,
            totalSessions: 12,
            remainingSessions: 10, // đã tập 2 buổi
            pricePaid: 4000000.00,
            startDate,
            endDate,
            status: 'ACTIVE'
        }
    });

    await prisma.payment.create({
        data: {
            user_id: members[0].id,
            coach_assignment_id: assignment1.id,
            amount: 4000000.00,
            method: 'BANK_TRANSFER',
            status: 'PAID',
            transaction_ref: 'FT123456789',
            paid_at: new Date()
        }
    });

    // Lê Thị Bình (members[1]) thuê Trần Thị Hương (coach2) gói 12 buổi Giảm Mỡ
    const assignment2 = await prisma.coachAssignment.create({
        data: {
            coachId: coach2.id,
            userId: members[1].id,
            ptPackageId: package1.id,
            totalSessions: 12,
            remainingSessions: 12, // chưa tập buổi nào
            pricePaid: 4500000.00,
            startDate,
            endDate,
            status: 'ACTIVE'
        }
    });

    await prisma.payment.create({
        data: {
            user_id: members[1].id,
            coach_assignment_id: assignment2.id,
            amount: 4500000.00,
            method: 'VNPAY',
            status: 'PAID',
            transaction_ref: 'VNP99887766',
            paid_at: new Date()
        }
    });

    console.log('📅 Tạo lịch hẹn tập & Giáo án tập luyện chi tiết...');
    // Tạo 2 buổi tập đã HOÀN THÀNH cho Trần Văn An để giải thích tại sao remainingSessions = 10
    const pastDate1 = new Date();
    pastDate1.setDate(pastDate1.getDate() - 5);
    pastDate1.setHours(9, 0, 0, 0); // 9:00 AM

    const sessionPast1 = await prisma.workoutSession.create({
        data: {
            userId: members[0].id,
            coachId: coach1.id,
            scheduledAt: pastDate1,
            durationMinutes: 60,
            status: WorkoutSessionStatus.COMPLETED,
            note: 'Hội viên hoàn thành rất tốt, đốt cháy 400kcal.'
        }
    });

    await prisma.exerciseLog.createMany({
        data: [
            { sessionId: sessionPast1.id, exerciseName: 'Barbell Squat', sets: 4, reps: 12, weightKg: 50, restSeconds: 60, note: 'Khởi động kỹ khớp gối' },
            { sessionId: sessionPast1.id, exerciseName: 'Leg Press', sets: 3, reps: 15, weightKg: 100, restSeconds: 90 },
            { sessionId: sessionPast1.id, exerciseName: 'Plank', sets: 3, reps: 60, weightKg: 0, restSeconds: 45 }
        ]
    });

    const pastDate2 = new Date();
    pastDate2.setDate(pastDate2.getDate() - 3);
    pastDate2.setHours(15, 0, 0, 0); // 3:00 PM

    const sessionPast2 = await prisma.workoutSession.create({
        data: {
            userId: members[0].id,
            coachId: coach1.id,
            scheduledAt: pastDate2,
            durationMinutes: 60,
            status: WorkoutSessionStatus.COMPLETED,
            note: 'Tập các bài Cardio đốt mỡ lưng.'
        }
    });

    await prisma.exerciseLog.createMany({
        data: [
            { sessionId: sessionPast2.id, exerciseName: 'Lat Pulldown', sets: 4, reps: 12, weightKg: 35, restSeconds: 60 },
            { sessionId: sessionPast2.id, exerciseName: 'Dumbbell Row', sets: 3, reps: 12, weightKg: 12, restSeconds: 60 },
            { sessionId: sessionPast2.id, exerciseName: 'Treadmill Run', sets: 1, reps: 1, weightKg: 0, restSeconds: 0, note: 'Chạy dốc 5% trong 15 phút' }
        ]
    });

    // Tạo 1 lịch hẹn tập TƯƠNG LAI đang chờ diễn ra
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    futureDate.setHours(10, 0, 0, 0); // 10:00 AM

    const sessionFuture = await prisma.workoutSession.create({
        data: {
            userId: members[0].id,
            coachId: coach1.id,
            scheduledAt: futureDate,
            durationMinutes: 60,
            status: WorkoutSessionStatus.PLANNED,
            note: 'Tập nhóm cơ Ngực và Tay sau.'
        }
    });

    await prisma.exerciseLog.createMany({
        data: [
            { sessionId: sessionFuture.id, exerciseName: 'Flat Bench Press', sets: 4, reps: 10, weightKg: 40, restSeconds: 90 },
            { sessionId: sessionFuture.id, exerciseName: 'Incline Dumbbell Press', sets: 3, reps: 12, weightKg: 14, restSeconds: 60 },
            { sessionId: sessionFuture.id, exerciseName: 'Tricep Rope Pushdown', sets: 3, reps: 15, weightKg: 15, restSeconds: 45 }
        ]
    });

    console.log('🏛️ Tạo các lớp học nhóm (Group Classes) do PT dạy...');
    // Tạo 1 lớp nhóm do Trần Thị Hương (coach2) đứng lớp để check trùng lịch
    const groupClassDate = new Date();
    groupClassDate.setDate(groupClassDate.getDate() + 1);
    groupClassDate.setHours(8, 30, 0, 0); // 8:30 AM

    await prisma.groupClass.create({
        data: {
            coachId: coach2.id,
            name: 'Lớp Yoga Trị Liệu & Giãn Cơ Căn Bản',
            scheduledAt: groupClassDate,
            durationMinutes: 60,
            status: GroupClassStatus.SCHEDULED
        }
    });

    console.log('🎉 Gieo hạt (Seeding) dữ liệu hoàn tất thành công!');
    console.log('🌟 --- THÔNG TIN ĐĂNG NHẬP MẪU --- 🌟');
    console.log('Mật khẩu chung cho tất cả tài khoản: GymManager@123');
    console.log('1. Admin: admin@gym.com');
    console.log('2. PT Nguyễn Văn Nam (Tăng cơ, giảm mỡ): coach.nam@gym.com');
    console.log('3. PT Trần Thị Hương (Yoga, giảm cân): coach.huong@gym.com');
    console.log('4. Hội viên Trần Văn An (đang thuê PT Nam): member.an@gmail.com');
    console.log('5. Hội viên Lê Thị Bình (đang thuê PT Hương): member.binh@gmail.com');
}

main()
    .catch((e) => {
        console.error('❌ Lỗi gieo hạt dữ liệu:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
