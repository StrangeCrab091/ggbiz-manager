# GGBizManager

Ứng dụng quản lý Google Business Profile với AI phân tích cảm xúc, tự động phản hồi đánh giá, cảnh báo Telegram và quét đối thủ cạnh tranh.

## Tính năng chính

- Kết nối Google Business Profile qua OAuth 2.0
- Kéo và quản lý đánh giá (reviews) từ Google Maps
- Tự động phân tích cảm xúc và sinh phản hồi bằng Gemini AI
- Cảnh báo tức thì qua Telegram khi có review tiêu cực
- Quét đối thủ cạnh tranh bằng Google Places API
- Dashboard thống kê, phân tích xu hướng

## Yêu cầu

- Node.js >= 20.x
- npm >= 10.x
- MongoDB Atlas (miễn phí) hoặc MongoDB local

## Cài đặt

### 1. Clone repo

```bash
git clone https://github.com/your-username/mapmanager.git
cd mapmanager
```

### 2. Cài đặt dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Cấu hình biến môi trường

```bash
cd backend
cp .env.example .env
```

Mở file `backend/.env` và điền đầy đủ các giá trị. Xem hướng dẫn chi tiết từng bước ngay trong file `.env.example`.

**Tóm tắt các key cần có:**

| Key | Lấy ở đâu |
|-----|-----------|
| `MONGO_URI` | [MongoDB Atlas](https://www.mongodb.com/atlas) — miễn phí |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) → Credentials → OAuth 2.0 |
| `GOOGLE_API_KEY` | Google Cloud Console → Credentials → API Key |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) — miễn phí |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Telegram @BotFather |

### 4. Chạy local

Mở 2 terminal:

```bash
# Terminal 1 — Backend (port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev
```

Truy cập: **http://localhost:5173**

### 5. Kết nối Google Business Profile

Sau khi chạy app, vào trang **Settings** → mục **Kết nối Google** → nhấn nút kết nối → đăng nhập tài khoản Google có quyền quản lý Business Profile. App sẽ tự động kéo danh sách địa điểm về.

## Cấu trúc thư mục

```
├── backend/
│   ├── src/
│   │   ├── controllers/   # Xử lý request/response
│   │   ├── services/      # Logic nghiệp vụ (Google API, AI, Telegram...)
│   │   ├── models/        # MongoDB schemas
│   │   ├── routes/        # Định nghĩa API endpoints
│   │   └── middlewares/
│   ├── .env.example       # Mẫu cấu hình — đọc kỹ trước khi chạy
│   └── server.js
└── frontend/
    └── src/
        ├── pages/
        ├── components/
        └── services/
```

## Lưu ý bảo mật

- **Không** commit file `.env` lên GitHub — file này đã có trong `.gitignore`
- Giới hạn phạm vi API Key trên Google Cloud Console (chỉ cho phép đúng API cần dùng)
- Với OAuth, để chế độ **Testing** là đủ cho cá nhân/nhóm nhỏ (tối đa 100 test users)

## Tech stack

- **Frontend:** React 19, Vite, TailwindCSS, Recharts, Leaflet
- **Backend:** Node.js, Express 5, MongoDB (Mongoose)
- **AI:** Google Gemini API
- **Tích hợp:** Google Business Profile API, Google Places API, Telegram Bot API
