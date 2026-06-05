import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { DashboardService } from "./dashboard.service";

const dashboardService = new DashboardService();

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    
    // BƯỚC 1: PHÂN QUYỀN TRUY CẬP (Chỉ ADMIN và STAFF được phép gọi)
    if (userRole !== "ADMIN" && userRole !== "STAFF") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập dữ liệu quản trị."
      });
    }

    const range = (req.query.range as 'W' | 'M' | 'Y') || 'M';
    
    // Lấy dữ liệu từ service
    const stats = await dashboardService.getAdminStats(range);

    // BƯỚC 2: BẢO MẬT DỮ LIỆU TÀI CHÍNH CHO STAFF
    if (userRole === "STAFF") {
      // 1. Xóa các metrics tài chính nhạy cảm
      delete (stats.metrics as any).monthlyRevenue;
      delete (stats.metrics as any).monthlyRevenueGrowth;
      delete (stats.metrics as any).mrr;
      delete (stats.metrics as any).arpu;
      delete (stats.metrics as any).ltv;

      // 2. Xóa biểu đồ doanh thu
      delete (stats as any).revenueChart;

      // 3. Ẩn số tiền giao dịch trong bảng
      stats.recentTransactions = stats.recentTransactions.map(t => ({
        ...t,
        amount: "******" // Ẩn hoàn toàn số tiền
      }));
    }

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tải thông tin dashboard.",
      error: error instanceof Error ? error.message : "INTERNAL_SERVER_ERROR"
    });
  }
};