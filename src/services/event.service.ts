import { EventEmitter } from 'events';
import { prisma } from '../config/client';
import { NotificationService } from '../modules/notification/notification.service';
import { NotificationType } from '@prisma/client';
import { NotificationRepository } from '../modules/notification/notification.repository';

const notificationRepository = new NotificationRepository(prisma);
const notificationService = new NotificationService(notificationRepository);

export const eventEmitter = new EventEmitter();

// Hàm tiện ích: Lấy toàn bộ ADMIN + STAFF thuộc chi nhánh chỉ định
async function getStaffAndAdmins(branchId?: number | null) {
  return prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        // Điều kiện 1: Nếu là ADMIN thì lấy luôn (vì ADMIN nhận thông báo toàn hệ thống)
        { role: 'ADMIN' },
        
        // Điều kiện 2: Nếu là STAFF thì phải thuộc đúng chi nhánh được truyền vào
        {
          role: 'STAFF',
          ...(branchId ? { branchId } : {})
        }
      ]
    }
  });
}

// =========================================================================
// I. NHÓM SỰ KIỆN GÓI TẬP (MEMBERSHIP)
// =========================================================================

// 1. Đăng ký mua gói tập mới thành công (Đang chờ thanh toán)
eventEmitter.on('membership.registered', async (data) => {
  const buyer = await prisma.user.findUnique({ where: { id: data.userId } });

  // Thông báo cho chính Hội viên
  await notificationService.createNotification({
    userId: data.userId,
    title: "Đơn đăng ký gói tập thành công",
    content: `Gói tập "${data.planName}" đã được đăng ký. Vui lòng thanh toán số tiền ${Number(data.amount).toLocaleString()}đ bằng hình thức ${data.method}.`,
    type: NotificationType.PAYMENT_PENDING,
    referenceId: String(data.membershipId)
  });

  // Nếu chọn đóng tiền mặt, báo cho Staff/Admin chi nhánh để thu tiền
  if (data.method === 'CASH') {
    const staffs = await getStaffAndAdmins(buyer?.branchId);
    for (const staff of staffs) {
      await notificationService.createNotification({
        userId: staff.id,
        title: "Đơn mua gói tập chờ thu tiền mặt",
        content: `Hội viên ${buyer?.name} vừa đăng ký gói ${data.planName}. Vui lòng xác nhận thu tiền mặt: ${Number(data.amount).toLocaleString()}đ.`,
        type: NotificationType.PAYMENT_PENDING,
        referenceId: String(data.membershipId)
      });
    }
  }
});

// 2. Yêu cầu nâng cấp gói tập (Đang chờ đóng phí chênh lệch)
eventEmitter.on('membership.upgraded', async (data) => {
  const buyer = await prisma.user.findUnique({ where: { id: data.userId } });

  // Thông báo cho Hội viên
  await notificationService.createNotification({
    userId: data.userId,
    title: "Yêu cầu nâng cấp gói tập",
    content: `Đơn nâng cấp lên gói "${data.newPlanName}" đã được tạo. Vui lòng thanh toán khoản phí chênh lệch ${Number(data.amount).toLocaleString()}đ qua ${data.method}.`,
    type: NotificationType.PAYMENT_PENDING,
    referenceId: String(data.membershipId)
  });

  // Nếu đóng tiền mặt tại quầy
  if (data.method === 'CASH') {
    const staffs = await getStaffAndAdmins(buyer?.branchId);
    for (const staff of staffs) {
      await notificationService.createNotification({
        userId: staff.id,
        title: "Yêu cầu nâng cấp gói chờ thu tiền",
        content: `Hội viên ${buyer?.name} nâng cấp lên gói ${data.newPlanName}. Số tiền chênh lệch cần thu: ${Number(data.amount).toLocaleString()}đ.`,
        type: NotificationType.PAYMENT_PENDING,
        referenceId: String(data.membershipId)
      });
    }
  }
});

// 3. Admin chủ động hủy gói tập đang chạy của khách hàng
eventEmitter.on('membership.cancelled_by_admin', async (data) => {
  await notificationService.createNotification({
    userId: data.userId,
    title: "Gói tập của bạn đã bị hủy",
    content: `Gói tập hiện tại của bạn đã bị hủy bởi Ban quản lý phòng tập. Vui lòng liên hệ quầy lễ tân để biết thêm chi tiết.`,
    type: NotificationType.SESSION_CANCELLED
  });
});


// =========================================================================
// II. NHÓM SỰ KIỆN THANH TOÁN (PAYMENTS)
// =========================================================================

// 4. Thanh toán hóa đơn thành công (Duyệt CASH hoặc VNPay tự động)
eventEmitter.on('payment.success', async (payment) => {
  const buyer = await prisma.user.findUnique({ where: { id: payment.user_id } });

  // Thông báo cho Hội viên
  await notificationService.createNotification({
    userId: payment.user_id,
    title: "Thanh toán thành công 🎉",
    content: `Cảm ơn bạn! Hóa đơn #${payment.id} trị giá ${Number(payment.amount).toLocaleString()}đ đã được thanh toán thành công.`,
    type: NotificationType.PAYMENT_SUCCESS,
    referenceId: String(payment.id)
  });

  // Thông báo cho tất cả Staff/Admin quản lý tại chi nhánh đó
  const staffs = await getStaffAndAdmins(payment.branchId);
  for (const staff of staffs) {
    await notificationService.createNotification({
      userId: staff.id,
      title: "Giao dịch mới thành công",
      content: `Hội viên ${buyer?.name} đã thanh toán thành công hóa đơn #${payment.id} số tiền ${Number(payment.amount).toLocaleString()}đ.`,
      type: NotificationType.PAYMENT_SUCCESS,
      referenceId: String(payment.id)
    });
  }
});


// =========================================================================
// III. NHÓM SỰ KIỆN THUÊ & ĐỔI HUÂN LUYỆN VIÊN (PT BOOKING)
// =========================================================================

// 5. Đăng ký thuê PT thành công (Đang chờ thanh toán hợp đồng)
eventEmitter.on('pt.hired', async (data) => {
  const buyer = await prisma.user.findUnique({ where: { id: data.userId } });

  // Báo cho chính hội viên
  await notificationService.createNotification({
    userId: data.userId,
    title: "Đơn đăng ký thuê PT thành công",
    content: `Bạn đã đăng ký thuê HLV thành công. Vui lòng thanh toán số tiền ${Number(data.amount).toLocaleString()}đ để kích hoạt hợp đồng.`,
    type: NotificationType.PAYMENT_PENDING,
    referenceId: String(data.paymentId)
  });

  // Gửi cho lễ tân chi nhánh thu tiền nếu chọn CASH
  const staffs = await getStaffAndAdmins(buyer?.branchId);
  for (const staff of staffs) {
    await notificationService.createNotification({
      userId: staff.id,
      title: "Đơn thuê PT chờ thu tiền mặt",
      content: `Hội viên ${buyer?.name} đăng ký thuê PT. Số tiền cần thu tại quầy: ${Number(data.amount).toLocaleString()}đ.`,
      type: NotificationType.PAYMENT_PENDING,
      referenceId: String(data.paymentId)
    });
  }
});

// 6. Hội viên gửi yêu cầu xin đổi PT
eventEmitter.on('pt.change_requested', async (data) => {
  const member = await prisma.user.findUnique({ where: { id: data.userId } });
  
  // Gửi thông báo chờ duyệt cho toàn bộ Staff/Admin tại chi nhánh đó
  const staffs = await getStaffAndAdmins(member?.branchId);
  for (const staff of staffs) {
    await notificationService.createNotification({
      userId: staff.id,
      title: "Yêu cầu đổi PT mới",
      content: `Hội viên ${member?.name} vừa gửi yêu cầu đổi sang PT mới. Lý do: "${data.reason}".`,
      type: NotificationType.COACH_CHANGE_REQUESTED,
      referenceId: String(data.requestId)
    });
  }
});

// 7. Ban quản trị duyệt/từ chối yêu cầu đổi PT
eventEmitter.on('pt.change_processed', async (data) => {
  const request = await prisma.coachChangeRequest.findUnique({
    where: { id: data.requestId },
    include: { 
      user: true, 
      oldCoach: { include: { user: true } }, 
      newCoach: { include: { user: true } } 
    }
  });

  if (!request) return;

  if (data.approve) {
    // 7a. Nếu duyệt thành công (Ngang giá hoặc Đã đóng tiền chênh lệch)
    await notificationService.createNotification({
      userId: request.userId,
      title: "Yêu cầu đổi PT thành công",
      content: `Bạn đã chuyển sang luyện tập với huấn luyện viên mới: ${request.newCoach.user.name}.`,
      type: NotificationType.COACH_CHANGE_DECISION,
      referenceId: String(request.id)
    });

    // Báo cho PT Mới biết có học viên mới
    await notificationService.createNotification({
      userId: request.newCoach.userId,
      title: "Nhận học viên mới",
      content: `Bạn vừa được phân công hướng dẫn học viên mới: ${request.user.name}.`,
      type: NotificationType.COACH_CHANGE_DECISION,
    });

    // Báo cho PT Cũ biết học viên đã được chuyển
    await notificationService.createNotification({
      userId: request.oldCoach.userId,
      title: "Học viên chuyển PT",
      content: `Học viên ${request.user.name} của bạn đã chuyển sang huấn luyện viên khác.`,
      type: NotificationType.COACH_CHANGE_DECISION,
    });
  } else {
    // 7b. Nếu bị từ chối
    await notificationService.createNotification({
      userId: request.userId,
      title: "Yêu cầu đổi PT bị từ chối",
      content: `Yêu cầu xin chuyển sang PT ${request.newCoach.user.name} của bạn đã bị từ chối bởi ban quản trị.`,
      type: NotificationType.COACH_CHANGE_DECISION,
    });
  }
});

// 8. Hội viên tự hủy đơn đăng ký PT (chưa thanh toán)
eventEmitter.on('pt.pending_cancel', async (data) => {
  const buyer = await prisma.user.findUnique({ where: { id: data.userId } });

  // Thông báo cho Staff/Admin chi nhánh biết để cập nhật tình hình
  const staffs = await getStaffAndAdmins(buyer?.branchId);
  for (const staff of staffs) {
    await notificationService.createNotification({
      userId: staff.id,
      title: "Đơn thuê PT đã bị hủy",
      content: `Hội viên ${buyer?.name} đã chủ động hủy đơn đăng ký thuê PT chưa thanh toán.`,
      type: NotificationType.SESSION_CANCELLED
    });
  }
});