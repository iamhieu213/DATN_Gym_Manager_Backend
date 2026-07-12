import 'dotenv/config';
import app from './app'
import http from 'http';
import { initSocketServer } from './services/socket.service';
import { startCleanupCron } from './services/cron.service'
import './services/event.service'; 

const PORT = 3000
const server = http.createServer(app);
initSocketServer(server);

// Sửa dòng dưới này: Thay 'app.listen' bằng 'server.listen'
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  // Khởi động tiến trình chạy ngầm quét dọn dẹp hóa đơn hết hạn
  startCleanupCron();
})