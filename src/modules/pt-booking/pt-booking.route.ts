import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { 
    hirePt, 
    getMyActiveCoach, 
    getMyStudents, 
    requestOrExecuteCoachChange,
    cancelMyBooking,
    adminDirectChangeCoach,
    adminProcessChangeRequest,
    getChangeRequests,
    getMyAssignments,
    adminGetAssignments
} from './pt-booking.controller';

const router = Router();

router.use(authMiddleware);

// --- HỘI VIÊN (MEMBERS) ---
router.post('/hire', hirePt); // Đăng ký thuê PT
router.get('/my-coach', getMyActiveCoach); // Lấy thông tin PT hoạt động hiện tại của tôi
router.get('/my-bookings', getMyAssignments); // Lấy danh sách đăng ký PT của tôi
router.post('/my-booking/:id/cancel', cancelMyBooking); // Hội viên tự hủy đơn đăng ký chưa thanh toán
router.post('/change-coach/:assignmentId', requestOrExecuteCoachChange); // Hội viên đổi PT (tự động đổi nếu chưa thanh toán, gửi yêu cầu nếu đã thanh toán)

// --- HUẤN LUYỆN VIÊN (COACHES) ---
router.get('/my-students', getMyStudents); // Lấy danh sách học viên

// --- BAN QUẢN TRỊ (ADMIN & STAFF) ---
router.post('/admin/direct-change', adminDirectChangeCoach); // Đổi trực tiếp PT cho hội viên
router.put('/admin/change-request/:requestId/process', adminProcessChangeRequest); // Phê duyệt yêu cầu đổi PT
router.get('/admin/change-requests', getChangeRequests); // Lấy danh sách yêu cầu đổi PT chờ duyệt
router.get('/admin/bookings', adminGetAssignments); // Lấy toàn bộ hợp đồng thuê PT của hệ thống

export default router;