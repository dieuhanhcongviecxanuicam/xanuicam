# Production run notes

Các lệnh quản lý nhanh cho môi trường production (chạy trong thư mục `backend`):

- Start (pm2 ecosystem):

  npm run prod:start

  (tương đương):
  pm2 start ecosystem.config.js --env production

- Stop:

  npm run prod:stop

  (tương đương):
  pm2 stop ubnd-backend

- Restart:

  npm run prod:restart

  (tương đương):
  pm2 restart ubnd-backend

- Logs (real-time):

  npm run prod:logs

  (tương đương):
  pm2 logs ubnd-backend

- Check status:

  pm2 list
  pm2 show ubnd-backend

- Kill pm2 daemon:

  pm2 kill

---

Frontend build / deploy notes:

- Build production bundle (thư mục `frontend`):

  cd ../frontend
  npm install
  npm run build

- Khi `NODE_ENV=production` backend đã cấu hình để phục vụ nội dung build từ `../frontend/build`.

---

Lưu ý:
- Backend production mặc định sử dụng `PORT=5000` (xem `ecosystem.config.js`).
- Nếu cần bật frontend dev server thay vì phục vụ static, chạy `npm start` trong `frontend` (dev server sẽ hỏi chuyển cổng nếu `3000` bị chiếm).
