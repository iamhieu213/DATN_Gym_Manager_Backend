import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

let io: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HTTPServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: '*', // Trong môi trường production, bạn nên thay '*' bằng domain của frontend để bảo mật
            methods: ['GET', 'POST'],
        },
    });

    // Middleware bảo mật: Chỉ cho kết nối nếu truyền Token hợp lệ
    io.use((socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
        if (!token) {
            return next(new Error('Chưa cung cấp token xác thực kết nối socket'));
        }

        try {
            // Cắt bỏ tiền tố "Bearer " nếu có
            const parsedToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            
            // Giải mã token bằng JWT_ACCESS_SECRET đã có trong file .env của bạn
            const decoded = jwt.verify(parsedToken, process.env.JWT_ACCESS_SECRET!) as { userId: number };
            
            // Lưu lại userId vào socket để sử dụng ở các sự kiện bên dưới
            socket.data.userId = decoded.userId;
            next();
        } catch (err) {
            return next(new Error('Token không hợp lệ hoặc đã hết hạn'));
        }
    });

    // Lắng nghe khi có người dùng kết nối thành công
    io.on('connection', (socket) => {
        const userId = socket.data.userId;
        const roomName = `room_user_${userId}`;
        
        // Đưa người dùng vào một phòng riêng theo User ID của họ
        socket.join(roomName);
        console.log(`[Socket.io] User ID: ${userId} kết nối thành công và vào phòng: ${roomName}`);

        // Lắng nghe khi người dùng ngắt kết nối
        socket.on('disconnect', () => {
            console.log(`[Socket.io] User ID: ${userId} đã ngắt kết nối.`);
        });
    });

    return io;
};

/**
 * Hàm gửi tin nhắn/sự kiện trực tiếp đến một người dùng cụ thể bằng User ID của họ.
 * Bất cứ service nào ở Backend cũng có thể gọi hàm này để gửi thông báo realtime.
 */
export const sendToUser = (userId: number, event: string, data: any) => {
    if (io) {
        const roomName = `room_user_${userId}`;
        io.to(roomName).emit(event, data);
        console.log(`[Socket.io] Đã đẩy sự kiện "${event}" tới phòng: ${roomName}`);
    }
};