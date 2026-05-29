import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.route';
import userRoutes from './modules/user/user.route';
import planRoutes from './modules/plans/plans.routes'
import membershipRoutes from './modules/membership/membership.route'
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

export default app;