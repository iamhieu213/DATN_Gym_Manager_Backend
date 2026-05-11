import { Router } from 'express';
import { register, 
    verifyRegister, 
    login, 
    refreshAccessToken, 
    logout, 
    changePassword, 
    requestForgotPasswordOtp, 
    verifyForgotPasswordOtp,
    resetPassword, 
    googleAuthStart,
    googleAuthCallback
} from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
const router = Router();

router.post('/register', register);
router.post('/verify-register', verifyRegister);
router.post('/login', login);
router.post('/refresh-access-token', refreshAccessToken);
router.post('/logout', logout);
router.post('/change-password', authMiddleware, changePassword);

//Api quen mat khau 
//Gui ma xac thuc
router.post('/request-forgot-password-otp', requestForgotPasswordOtp);
//Xac thuc ma Otp
router.post('/verify-forgot-password-otp', verifyForgotPasswordOtp);
//Thay doi mat khau
router.post('/reset-password', resetPassword);
//Api dang nhap google
router.get('/google', googleAuthStart);
router.get('/google/callback', googleAuthCallback);
export default router;