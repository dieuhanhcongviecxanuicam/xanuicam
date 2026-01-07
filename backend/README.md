# Backend - UBND xã Núi Cấm

Backend cho ứng dụng Quản lý công việc của UBND xã Núi Cấm, được xây dựng bằng Node.js, Express, và PostgreSQL.

## Yêu cầu

- Node.js (v16 trở lên)
- PostgreSQL

## Cài đặt

1.  **Clone a repository:**
    ```bash
    git clone <your-repository-url>
    cd UBNDxaNuiCam/backend
    ```

2.  **Cài đặt dependencies:**
    ```bash
    npm install
    ```

3.  **Thiết lập Cơ sở dữ liệu:**
    - Tạo một database mới trong PostgreSQL (ví dụ: `ubndxanuicam`).
    - Import schema và dữ liệu ban đầu từ file `database.sql` (bạn cần tạo file này).

4.  **Cấu hình Biến môi trường:**
    - Sao chép tệp `.env.example` thành `.env`:
      ```bash
      cp .env.example .env
      ```
    - Mở tệp `.env` và điền các thông tin cấu hình cho database và JWT secret của bạn.

## Khởi chạy ứng dụng

- **Chế độ phát triển (với auto-reload):**
  ```bash
  npm run dev