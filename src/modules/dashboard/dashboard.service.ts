import { prisma } from "../../config/client";
import { PaymentStatus, UserRole, EquipmentStatus } from "@prisma/client";

export class DashboardService {
  async getAdminStats(range: 'W' | 'M' | 'Y' = 'M') {
    const now = new Date();

    // Các mốc thời gian để so sánh tăng trưởng
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // ==========================================
    // 1. TÍNH CÁC CHỈ SỐ METRICS (4 Ô TRÊN CÙNG)
    // ==========================================

    // A. Hội viên hoạt động & Tăng trưởng (%)
    const activeMembers = await prisma.membership.count({
      where: {
        status: 'ACTIVE',
        is_active: true,
        end_date: { gte: now }
      }
    });

    const activeMembersLastMonth = await prisma.membership.count({
      where: {
        status: { in: ['ACTIVE', 'UPGRADED'] },
        start_date: { lte: endOfLastMonth },
        end_date: { gte: startOfLastMonth }
      }
    });

    let activeMembersGrowth = 0;
    if (activeMembersLastMonth > 0) {
      activeMembersGrowth = Number((((activeMembers - activeMembersLastMonth) / activeMembersLastMonth) * 100).toFixed(1));
    } else if (activeMembers > 0) {
      activeMembersGrowth = 100;
    }

    // B. Doanh thu tháng hiện tại & Tăng trưởng (%)
    const revenueSumThisMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        paid_at: { gte: startOfThisMonth }
      }
    });
    const monthlyRevenue = Number(revenueSumThisMonth._sum.amount || 0);

    const revenueSumLastMonth = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        paid_at: { gte: startOfLastMonth, lt: startOfThisMonth }
      }
    });
    const lastMonthRevenue = Number(revenueSumLastMonth._sum.amount || 0);

    let monthlyRevenueGrowth = 0;
    if (lastMonthRevenue > 0) {
      monthlyRevenueGrowth = Number((((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1));
    } else if (monthlyRevenue > 0) {
      monthlyRevenueGrowth = 100;
    }

    // C. Tỉ lệ giữ chân & Tỉ lệ hủy gói (%)
    const totalMemberships = await prisma.membership.count();
    const cancelledMemberships = await prisma.membership.count({
      where: { status: 'CANCELLED' }
    });
    const churnRate = totalMemberships > 0 ? Number(((cancelledMemberships / totalMemberships) * 100).toFixed(1)) : 0;
    const retentionRate = Number((100 - churnRate).toFixed(1));

    // D. Tính chỉ số MRR, ARPU, LTV
    const currentYear = now.getFullYear();
    const currentMonthIndex = now.getMonth() + 1; // Số tháng đã qua từ đầu năm (1 - 12)

    // MRR: Doanh thu trung bình tháng trong năm nay
    const totalYearRevenueAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        paid_at: { gte: new Date(currentYear, 0, 1) }
      }
    });
    const totalYearRevenue = Number(totalYearRevenueAgg._sum.amount || 0);
    const mrr = Math.round(totalYearRevenue / currentMonthIndex);

    // ARPU: Doanh thu trung bình trên mỗi hội viên đang hoạt động
    const arpu = activeMembers > 0 ? Math.round(monthlyRevenue / activeMembers) : 0;

    // LTV: Tổng doanh thu toàn thời gian / Số khách hàng duy nhất đã thanh toán
    const allTimeRevenueAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: PaymentStatus.PAID }
    });
    const totalAllTimeRevenue = Number(allTimeRevenueAgg._sum.amount || 0);

    const uniquePayingUsers = await prisma.payment.groupBy({
      by: ['user_id'],
      where: { status: PaymentStatus.PAID }
    });
    const totalPayingUsers = uniquePayingUsers.length;
    const ltv = totalPayingUsers > 0 ? Math.round(totalAllTimeRevenue / totalPayingUsers) : 0;

    // ==========================================
    // 2. BIỂU ĐỒ DOANH THU (THEO THỜI GIAN)
    // ==========================================
    let chartData: { label: string; value: number }[] = [];

    if (range === 'W') {
      // Biểu đồ Tuần: Lấy dữ liệu 7 ngày qua
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        d.setHours(0, 0, 0, 0);
        
        const nextD = new Date(d);
        nextD.setDate(d.getDate() + 1);

        const dayRevenue = await prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: PaymentStatus.PAID,
            paid_at: { gte: d, lt: nextD }
          }
        });
        
        const dayLabel = d.toLocaleDateString('vi-VN', { weekday: 'short' }); // T2, T3...
        chartData.push({
          label: dayLabel,
          value: Number(dayRevenue._sum.amount || 0)
        });
      }
    } else if (range === 'Y') {
      // Biểu đồ Năm: Lấy dữ liệu 5 năm gần nhất
      const currentYear = now.getFullYear();
      for (let i = 4; i >= 0; i--) {
        const targetYear = currentYear - i;
        const startOfYear = new Date(targetYear, 0, 1);
        const endOfYear = new Date(targetYear + 1, 0, 1);

        const yearRevenue = await prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: PaymentStatus.PAID,
            paid_at: { gte: startOfYear, lt: endOfYear }
          }
        });

        chartData.push({
          label: targetYear.toString(),
          value: Number(yearRevenue._sum.amount || 0)
        });
      }
    } else {
      // Mặc định là Tháng (M): Lấy dữ liệu 12 tháng trong năm hiện tại
      const currentYear = now.getFullYear();
      for (let month = 0; month < 12; month++) {
        const startOfM = new Date(currentYear, month, 1);
        const endOfM = new Date(currentYear, month + 1, 1);

        const monthRevenue = await prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: PaymentStatus.PAID,
            paid_at: { gte: startOfM, lt: endOfM }
          }
        });

        chartData.push({
          label: `Th ${month + 1}`,
          value: Number(monthRevenue._sum.amount || 0)
        });
      }
    }

    // ==========================================
    // 3. NHẬT KÝ HỆ THỐNG (LIVE ACTIVITIES LOGS)
    // ==========================================
    const recentUsers = await prisma.user.findMany({
      where: { role: UserRole.USER },
      orderBy: { createdAt: 'desc' },
      take: 2
    });

    const recentPayments = await prisma.payment.findMany({
      where: { status: PaymentStatus.PAID },
      orderBy: { paid_at: 'desc' },
      take: 2,
      include: { user: true }
    });

    const recentBookings = await prisma.workoutSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 2,
      include: { user: true }
    });

    const brokenEquipments = await prisma.equipment.findMany({
      where: { status: { in: [EquipmentStatus.UNDER_MAINTENANCE, EquipmentStatus.OUT_OF_SERVICE] } },
      orderBy: { updatedAt: 'desc' },
      take: 2
    });

    // Gom nhóm và sắp xếp theo thời gian mới nhất
    const systemLogs = [
      ...recentUsers.map(u => ({
        id: `signup-${u.id}`,
        type: 'signup',
        title: 'Hội viên đăng ký mới',
        subtitle: `${u.name} — Thành viên mới`,
        timestamp: u.createdAt
      })),
      ...recentPayments.map(p => ({
        id: `payment-${p.id}`,
        type: 'payment',
        title: 'Đã nhận thanh toán',
        subtitle: `Mã HD #${p.id} — ${Number(p.amount).toLocaleString('vi-VN')}đ từ ${p.user.name}`,
        timestamp: p.paid_at || p.created_at
      })),
      ...recentBookings.map(b => ({
        id: `booking-${b.id}`,
        type: 'booking',
        title: 'Lịch hẹn tập mới',
        subtitle: `Hội viên ${b.user.name} đặt buổi tập`,
        timestamp: b.createdAt
      })),
      ...brokenEquipments.map(e => ({
        id: `alert-${e.id}`,
        type: 'alert',
        title: 'Cảnh báo thiết bị',
        subtitle: `${e.name} (${e.code}) — Trạng thái: ${e.status === 'UNDER_MAINTENANCE' ? 'Đang bảo trì' : 'Hỏng hóc'}`,
        timestamp: e.updatedAt
      }))
    ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 4);

    // ==========================================
    // 4. GIAO DỊCH GẦN ĐÂY (5 GIAO DỊCH MỚI NHẤT)
    // ==========================================
    const dbTransactions = await prisma.payment.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { user: true }
    });

    const recentTransactions = dbTransactions.map(t => ({
      id: `KN-${t.id}`,
      member: t.user.name,
      amount: `${Number(t.amount).toLocaleString('vi-VN')}đ`,
      status: t.status.toLowerCase(), // 'paid', 'pending', 'failed'
      date: t.paid_at || t.created_at
    }));

    // ==========================================
    // 5. DANH SÁCH HUẤN LUYỆN VIÊN (MOCK RATING LÀ 5)
    // ==========================================
    const dbCoaches = await prisma.coachProfile.findMany({
      include: {
        user: true,
        assignments: { where: { status: 'ACTIVE' } }
      },
      take: 3
    });

    const trainers = dbCoaches.map(c => ({
      name: c.user.name,
      role: c.speciality || "Huấn luyện viên",
      activeSlots: `${c.assignments.length} Lớp hoạt động`,
      rating: 5, // MOCK DUY NHẤT ĐIỂM RATING LÀ 5 SAO
      image: c.user.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuBicJHCpHQa5ucE2_XO0p3xE4X6CpcRyx7RbLZu8LVZCdhGkywOP02qGL03HGOMstn4WNxmPciTmVQzyXFMSfZGabBQxco0CvCVenakiM20O9cvSWsErp4ICPnmNsXn154URmZoJakpds4P9nzWJ27Hcl0NddQ6HKvIYzuid-W0m4Du0tIWy69SUKUu9v8H-1rC0TZqg2z4o8jbC-S6zfrqxsoo6jIpRrCqruZOHPUPMPpExushvk6QyQqJp1N2CrMBUUn5m-J59pI"
    }));

    return {
      metrics: {
        activeMembers,
        activeMembersGrowth,
        monthlyRevenue,
        monthlyRevenueGrowth,
        retentionRate,
        churnRate,
        mrr,
        arpu,
        ltv
      },
      revenueChart: chartData,
      logs: systemLogs.map(log => ({
        id: log.id,
        type: log.type,
        title: log.title,
        subtitle: log.subtitle,
        time: this.formatTimeAgo(log.timestamp) // Chuyển sang chuỗi relative time
      })),
      recentTransactions,
      trainers
    };
  }

  private formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval >= 1) return `${interval} năm trước`;
    
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval} tháng trước`;
    
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval} ngày trước`;
    
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval} giờ trước`;
    
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval} phút trước`;
    
    return "Vừa xong";
  }
}