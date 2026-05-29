import 'dotenv/config';
import app from './app'
import { startCleanupCron } from './services/cron.service'

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  // Khởi động tiến trình chạy ngầm quét dọn dẹp hóa đơn hết hạn
  startCleanupCron()
})