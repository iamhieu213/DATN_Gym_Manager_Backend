import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.route';
import userRoutes from './modules/user/user.route';
import planRoutes from './modules/plans/plans.routes'
import membershipRoutes from './modules/membership/membership.route'
import checkInRoutes from './modules/checkin/checkin.route'
import coachRoutes from './modules/coach/coach.route'
import ptPackageRoutes from './modules/pt-package/pt-package.route'
import ptBooking from './modules/pt-booking/pt-booking.route'
import paymentRoutes from './modules/payment/payment.route';
import equipmentRoutes from './modules/equipment/equipment.route';
import dashboardRoutes from './modules/dashboard/dashboard.route';

import cookieParser from 'cookie-parser';
const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.get('/', (req,res) => {
    res.send('Gym Api is running');
})

/** Tạm thời để test OAuth khi chưa có frontend — trỏ FRONTEND_OAUTH_* vào các URL này. */
app.get('/oauth/success', (req, res) => {
    res.type('html').send(
        `<pre>OAuth success\n\n${JSON.stringify(req.query, null, 2)}</pre>`
    );
});
app.get('/oauth/error', (req, res) => {
    res.type('html').send(
        `<pre>OAuth error\n\n${JSON.stringify(req.query, null, 2)}</pre>`
    );
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/plan", planRoutes);
app.use("/membership", membershipRoutes);
app.use("/check-in", checkInRoutes);
app.use("/coach", coachRoutes);
app.use("/pt-package", ptPackageRoutes);
app.use("/pt-booking", ptBooking);
app.use("/payments", paymentRoutes);
app.use("/equipment", equipmentRoutes);
app.use("/dashboard", dashboardRoutes);
export default app;