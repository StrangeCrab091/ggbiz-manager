# 🚀 MapManager — Hướng Dẫn Triển Khai Production

> **Phiên bản:** 1.0 | **Cập nhật:** 18/03/2026  
> **Mục tiêu:** Hướng dẫn "cầm tay chỉ việc" để triển khai MapManager từ Local lên Server thật.

---

## 📋 Mục Lục

1. [Tổng quan & Yêu cầu hệ thống](#1-tổng-quan--yêu-cầu-hệ-thống)
2. [Danh mục Biến môi trường (.env)](#2-danh-mục-biến-môi-trường-env)
3. [Hướng dẫn lấy Key / Credentials](#3-hướng-dẫn-lấy-key--credentials)
4. [Quy trình triển khai từng giai đoạn](#4-quy-trình-triển-khai-từng-giai-đoạn)
5. [Kiểm tra & Vận hành](#5-kiểm-tra--vận-hành)
6. [Bảo mật & Firewall](#6-bảo-mật--firewall)

---

## 1. Tổng quan & Yêu cầu hệ thống

### 1.1. Kiến trúc hệ thống

```mermaid
graph LR
    Client[🌐 Trình duyệt]-->Nginx[⚙️ Nginx Reverse Proxy :80/:443]
    Nginx-->|/api/*| Backend[🟢 Node.js Backend :5000]
    Nginx-->|/*| Frontend[📦 Vite Build Static Files]
    Backend-->MongoDB[(🍃 MongoDB Atlas)]
    Backend-->Google[☁️ Google Business API]
    Backend-->Gemini[🤖 Gemini AI API]
    Backend-->Telegram[📱 Telegram Bot API]
    Telegram-->|Webhook| Backend
```

### 1.2. Phần mềm yêu cầu trên Server

| Phần mềm | Phiên bản tối thiểu | Mục đích |
|-----------|---------------------|----------|
| **Ubuntu Server** | 22.04 LTS | Hệ điều hành (khuyến nghị) |
| **Node.js** | 20.x LTS | Chạy Backend Express |
| **npm** | 10.x | Quản lý package |
| **PM2** | 5.x | Process Manager (chạy Backend 24/7) |
| **Nginx** | 1.24+ | Reverse Proxy + phục vụ Frontend |
| **Git** | 2.x | Clone mã nguồn |
| **Certbot** | Latest | Cấu hình SSL/HTTPS miễn phí (Let's Encrypt) |

> [!NOTE]
> **MongoDB:** Hệ thống sử dụng **MongoDB Atlas** (cloud). Không cần cài MongoDB trên Server.  
> Nếu muốn dùng MongoDB local, cần cài thêm `mongod` 7.x.

### 1.3. Yêu cầu Domain & SSL

| Item | Chi tiết |
|------|----------|
| **Domain chính** | Ví dụ: `mapmanager.yourdomain.com` (trỏ A record về IP Server) |
| **SSL Certificate** | Dùng **Let's Encrypt** (miễn phí) qua Certbot |
| **Port mở** | 80 (HTTP), 443 (HTTPS), 5000 (Backend — chỉ internal) |

---

## 2. Danh mục Biến môi trường (.env)

> [!IMPORTANT]
> File `.env.example` đã được tạo sẵn tại `backend/.env.example`.  
> Chỉ cần `cp .env.example .env` rồi điền giá trị thật.

### 2.1. Bảng tổng hợp

| Nhóm | Biến | Mô tả | Bắt buộc |
|------|------|-------|----------|
| **APP_CONFIG** | `PORT` | Cổng Backend (mặc định: `5000`) | ✅ |
| | `NODE_ENV` | `production` hoặc `development` | ✅ |
| | `FRONTEND_URL` | URL Frontend (dùng cho CORS) | ✅ |
| | `WEBHOOK_SECRET` | Chuỗi bí mật bảo vệ webhook endpoint | ✅ |
| **DATABASE** | `MONGO_URI` | Connection string MongoDB | ✅ |
| **GOOGLE_CONFIG** | `GOOGLE_CLIENT_ID` | OAuth2 Client ID | ✅ |
| | `GOOGLE_CLIENT_SECRET` | OAuth2 Client Secret | ✅ |
| | `GOOGLE_REDIRECT_URI` | Callback URL sau khi đăng nhập Google | ✅ |
| | `GOOGLE_API_KEY` | API Key cho Google Maps / Places | ⬜ |
| **GEMINI_CONFIG** | `GEMINI_API_KEY` | API Key cho Gemini AI | ✅ |
| **TELEGRAM_CONFIG** | `TELEGRAM_BOT_TOKEN` | Token từ BotFather | ✅ |
| | `TELEGRAM_CHAT_ID` | ID chat nhận thông báo | ✅ |

### 2.2. File mẫu `.env.example`

```bash
# ===== [APP_CONFIG] =====
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://mapmanager.yourdomain.com
WEBHOOK_SECRET=your_random_secret_string_here

# ===== [DATABASE] =====
MONGO_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/googlemap

# ===== [GOOGLE_CONFIG] =====
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/api/auth/google/callback
GOOGLE_API_KEY=AIzaSy_xxxx

# ===== [GEMINI_CONFIG] =====
GEMINI_API_KEY=AIzaSy_xxxx

# ===== [TELEGRAM_CONFIG] =====
TELEGRAM_BOT_TOKEN=1234567890:AABBCCDD...
TELEGRAM_CHAT_ID=1234567890
```

---

## 3. Hướng dẫn lấy Key / Credentials

### 3.1. Google Cloud — OAuth2 Client ID & Secret

> [!IMPORTANT]
> Đây là bước **quan trọng nhất** để hệ thống có thể đọc/ghi review trên Google Maps.

#### Bước 1: Tạo Project trên Google Cloud Console

1. Truy cập [console.cloud.google.com](https://console.cloud.google.com)
2. Nhấn **"Select a project"** → **"New Project"**
3. Đặt tên: `MapManager Production`
4. Nhấn **Create**

#### Bước 2: Bật các API cần thiết

Vào **APIs & Services** → **Library**, tìm và **Enable** từng API sau:

| API | Mục đích |
|-----|----------|
| **My Business Business Information API** | Đọc thông tin chi nhánh |
| **My Business Account Management API** | Quản lý tài khoản Google Business |
| **Google My Business API** | Đọc/ghi review (v4) |
| **Maps JavaScript API** | Hiển thị bản đồ (Grid Scan) |
| **Places API** | Tìm kiếm đối thủ |

#### Bước 3: Tạo OAuth2 Credentials

1. Vào **APIs & Services** → **Credentials**
2. Nhấn **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Application type: **Web application**
4. Name: `MapManager Production`
5. **Authorized redirect URIs:** Thêm URL callback của server thật:

```
https://api.yourdomain.com/api/auth/google/callback
```

> [!WARNING]
> URL này **PHẢI KHỚP CHÍNH XÁC** với biến `GOOGLE_REDIRECT_URI` trong `.env`.
> Sai 1 ký tự sẽ gây lỗi `redirect_uri_mismatch`.

6. Nhấn **Create** → Ghi lại **Client ID** và **Client Secret**

#### Bước 4: Cấu hình OAuth Consent Screen

1. Vào **OAuth consent screen**
2. Chọn **External** (nếu chưa publish App) hoặc **Internal** (Google Workspace)
3. Điền thông tin: App name, Support email
4. **Scopes:** Thêm:
   - `https://www.googleapis.com/auth/business.manage`
5. **Test users:** Thêm email Google Business Profile của bạn
6. Nhấn **Save**

---

### 3.2. Gemini AI — API Key

1. Truy cập [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Đăng nhập bằng Google Account
3. Nhấn **"Create API Key"**
4. Chọn Project (hoặc tạo mới)
5. Copy API Key → Dán vào `GEMINI_API_KEY` trong `.env`

> [!TIP]
> Gemini API miễn phí với giới hạn **15 RPM** (requests/minute) cho model `gemini-2.5-flash`.  
> MapManager đã có cơ chế delay 2 phút giữa các request để tránh vượt quota.

---

### 3.3. Telegram Bot — Token & Chat ID

#### Lấy Bot Token

1. Mở Telegram, tìm **@BotFather**
2. Gửi lệnh: `/newbot`
3. Đặt tên Bot: `MapManager Alert Bot`
4. Đặt username: `mapmanager_alert_bot` (phải kết thúc bằng `bot`)
5. BotFather sẽ trả về Token — copy và dán vào `TELEGRAM_BOT_TOKEN` trong file `.env`

6. Copy → Dán vào `TELEGRAM_BOT_TOKEN`

#### Lấy Chat ID (Cá nhân)

1. Mở Telegram, tìm **@userinfobot** hoặc **@RawDataBot**
2. Gửi tin nhắn bất kỳ (ví dụ: `/start`)
3. Bot sẽ trả về thông tin của bạn, trong đó có `Chat ID`:

```json
{
  "id": 1749745981,
  "first_name": "Triều"
}
```

4. Copy số `id` → Dán vào `TELEGRAM_CHAT_ID`

#### Lấy Chat ID (Nhóm)

1. Thêm Bot vào nhóm Telegram
2. Gửi tin nhắn trong nhóm
3. Gọi API: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Tìm `"chat": { "id": -100xxxxx }` → đó là Chat ID nhóm (số âm)

---

## 4. Quy trình triển khai từng giai đoạn

### Giai đoạn 1: Cấu hình Server & Mã nguồn

#### 1a. Cài đặt phần mềm trên Ubuntu Server

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra phiên bản
node -v   # v20.x.x
npm -v    # 10.x.x

# Cài PM2 (Process Manager cho Node.js)
sudo npm install -g pm2

# Cài Nginx
sudo apt install -y nginx

# Cài Certbot (SSL miễn phí)
sudo apt install -y certbot python3-certbot-nginx

# Cài Git
sudo apt install -y git
```

#### 1b. Clone mã nguồn

```bash
# Tạo thư mục ứng dụng
sudo mkdir -p /var/www/mapmanager
sudo chown $USER:$USER /var/www/mapmanager

# Clone từ Git
cd /var/www/mapmanager
git clone https://github.com/YOUR_USERNAME/mapmanager.git .

# Hoặc upload bằng SCP từ máy local
# scp -r ./backend ./frontend user@server_ip:/var/www/mapmanager/
```

#### 1c. Cài đặt Dependencies

```bash
# Backend
cd /var/www/mapmanager/backend
npm install --production

# Frontend
cd /var/www/mapmanager/frontend
npm install
```

#### 1d. Cấu hình .env

```bash
cd /var/www/mapmanager/backend

# Copy file mẫu
cp .env.example .env

# Chỉnh sửa bằng nano (hoặc vim)
nano .env
# → Điền tất cả các giá trị thật vào
```

---

### Giai đoạn 2: Thiết lập Database

#### Phương án A: MongoDB Atlas (Khuyến nghị — Cloud)

1. Truy cập [cloud.mongodb.com](https://cloud.mongodb.com)
2. Tạo Cluster mới (Free Tier M0 hoặc Shared)
3. Tạo Database User:
   - Username: `mapmanager_user`
   - Password: `tạo_mật_khẩu_mạnh`
4. **Network Access:** Thêm IP Server vào Allowlist
   - Hoặc thêm `0.0.0.0/0` (cho phép tất cả — **không khuyến khích** cho Production)
5. Lấy Connection String:

Sau khi tạo xong, MongoDB Atlas sẽ cung cấp Connection String — copy và dán vào `MONGO_URI` trong file `.env`.

6. Dán vào `MONGO_URI` trong `.env`

#### Phương án B: MongoDB Local

```bash
# Cài MongoDB 7.x trên Ubuntu
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod

# Kiểm tra
mongosh --eval "db.runCommand({ping:1})"
```

Cấu hình `.env`:
```
MONGO_URI=mongodb://localhost:27017/googlemap
```

---

### Giai đoạn 3: Build Frontend & Chạy Backend 24/7

#### 3a. Build Frontend (Vite → Static Files)

```bash
cd /var/www/mapmanager/frontend

# Build production
npm run build

# Kết quả sẽ nằm trong thư mục: /var/www/mapmanager/frontend/dist/
ls dist/
# → index.html  assets/
```

> [!IMPORTANT]
> **Cập nhật API URL trong Frontend:**  
> Trước khi build, tìm và thay **tất cả** `http://localhost:5000` trong code Frontend thành URL Backend thật.
> 
> Có thể dùng lệnh:
> ```bash
> cd /var/www/mapmanager/frontend
> grep -r "localhost:5000" src/ --include="*.jsx" --include="*.js" -l
> # → Liệt kê các file cần sửa
> sed -i 's|http://localhost:5000|https://api.yourdomain.com|g' src/**/*.jsx src/**/*.js
> ```
> Sau đó chạy lại `npm run build`.

#### 3b. Chạy Backend với PM2

```bash
cd /var/www/mapmanager/backend

# Khởi động với PM2
pm2 start server.js --name "mapmanager-api" --env production

# Kiểm tra trạng thái
pm2 status

# Xem log real-time
pm2 logs mapmanager-api

# Tự động khởi động lại khi Server reboot
pm2 startup
pm2 save
```

**Các lệnh PM2 hay dùng:**

| Lệnh | Mục đích |
|-------|----------|
| `pm2 status` | Xem trạng thái các process |
| `pm2 logs mapmanager-api` | Xem log real-time |
| `pm2 restart mapmanager-api` | Restart Backend |
| `pm2 stop mapmanager-api` | Dừng Backend |
| `pm2 delete mapmanager-api` | Xóa process |
| `pm2 monit` | Dashboard giám sát CPU/RAM |

#### 3c. Cấu hình Nginx (Reverse Proxy)

Tạo file cấu hình:

```bash
sudo nano /etc/nginx/sites-available/mapmanager
```

Dán nội dung:

```nginx
server {
    listen 80;
    server_name mapmanager.yourdomain.com;

    # Frontend — Phục vụ static files từ Vite build
    root /var/www/mapmanager/frontend/dist;
    index index.html;

    # SPA: mọi route trả về index.html (React Router xử lý)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — Proxy pass đến Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout dài hơn cho các request AI (Gemini có thể mất 10-15s)
        proxy_read_timeout 60s;
        proxy_connect_timeout 30s;
    }
}
```

Kích hoạt:

```bash
# Tạo symlink
sudo ln -s /etc/nginx/sites-available/mapmanager /etc/nginx/sites-enabled/

# Kiểm tra cú pháp
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### 3d. Cài SSL (HTTPS) với Let's Encrypt

```bash
sudo certbot --nginx -d mapmanager.yourdomain.com

# Certbot sẽ tự động:
# 1. Xác minh domain
# 2. Tạo chứng chỉ SSL
# 3. Cập nhật file Nginx config (thêm listen 443 ssl)
# 4. Redirect HTTP → HTTPS

# Kiểm tra tự động gia hạn
sudo certbot renew --dry-run
```

---

### Giai đoạn 4: Cấu hình Webhook cố định

#### 4a. Đăng ký Telegram Webhook

Thay ngrok bằng URL server thật:

```bash
# Đăng ký webhook
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://mapmanager.yourdomain.com/api/webhook/telegram-callback"}'
```

**Phản hồi thành công:**
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

#### 4b. Kiểm tra Webhook đã hoạt động

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

**Phản hồi mong đợi:**
```json
{
  "ok": true,
  "result": {
    "url": "https://mapmanager.yourdomain.com/api/webhook/telegram-callback",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": null
  }
}
```

#### 4c. Cập nhật Google OAuth Redirect URI

1. Vào [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Chỉnh sửa OAuth Client
3. **Authorized redirect URIs:** Thêm URL production:

```
https://mapmanager.yourdomain.com/api/auth/google/callback
```

4. Nhấn Save
5. Cập nhật `GOOGLE_REDIRECT_URI` trong `.env` cho khớp

---

## 5. Kiểm tra & Vận hành

### 5.1. Health Check nhanh

Chạy tuần tự các lệnh sau để xác nhận hệ thống hoạt động:

```bash
# ✅ 1. Kiểm tra Backend đang chạy
pm2 status
# Kết quả: mapmanager-api phải ở trạng thái "online"

# ✅ 2. Kiểm tra API Health
curl https://mapmanager.yourdomain.com/api/health
# Kết quả: {"status":"OK","message":"Server đang hoạt động bình thường",...}

# ✅ 3. Kiểm tra Nginx
sudo systemctl status nginx
# Kết quả: active (running)

# ✅ 4. Kiểm tra SSL
curl -I https://mapmanager.yourdomain.com
# Kết quả: HTTP/2 200 (không phải 301/302)

# ✅ 5. Kiểm tra MongoDB kết nối
pm2 logs mapmanager-api --lines 20
# Tìm dòng: "✅ MongoDB đã kết nối thành công"

# ✅ 6. Kiểm tra Telegram Webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | python3 -m json.tool
# Tìm: "pending_update_count": 0, "last_error_date": null
```

### 5.2. Bảng xử lý lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|-----|-------------|------------|
| **HTTP 502 Bad Gateway** | Backend chưa chạy hoặc crash | `pm2 restart mapmanager-api` rồi `pm2 logs` |
| **Google API 401 Unauthorized** | Token OAuth2 hết hạn | Vào Settings trên Frontend → Nhấn "Kết nối lại Google" |
| **Google API 429 Too Many Requests** | Vượt quota API | Đợi 1 phút hoặc tăng quota trong Google Cloud Console |
| **MongoDB ECONNREFUSED** | DB không kết nối | Kiểm tra `MONGO_URI` trong `.env` và IP Allowlist trên Atlas |
| **Telegram "Not Found" khi nhấn nút** | Webhook URL sai | Chạy lại `setWebhook` với URL đúng |
| **Gemini "RESOURCE_EXHAUSTED"** | Vượt 15 RPM | Hệ thống tự retry. Nếu liên tục → chờ 1-2 phút |
| **Frontend hiển thị trắng** | Build lỗi hoặc chưa replace localhost | Kiểm tra `dist/` và chạy lại `npm run build` |
| **SSL Certificate Expired** | Certbot chưa tự gia hạn | `sudo certbot renew` |

### 5.3. Xem Log hệ thống

```bash
# Log Backend (PM2) — Real-time
pm2 logs mapmanager-api

# Log Backend — 100 dòng gần nhất
pm2 logs mapmanager-api --lines 100

# Log Nginx — Access
sudo tail -f /var/log/nginx/access.log

# Log Nginx — Error
sudo tail -f /var/log/nginx/error.log

# Tìm lỗi cụ thể trong log
pm2 logs mapmanager-api --lines 500 | grep "❌"
pm2 logs mapmanager-api --lines 500 | grep "429"
pm2 logs mapmanager-api --lines 500 | grep "401"
```

---

## 6. Bảo mật & Firewall

### 6.1. Cấu hình UFW Firewall

```bash
# Bật UFW
sudo ufw enable

# Cho phép SSH (QUAN TRỌNG — tránh bị lock out!)
sudo ufw allow 22/tcp

# Cho phép HTTP/HTTPS (Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# KHÔNG mở port 5000 ra ngoài (Backend chỉ chạy internal)
# Nginx proxy sẽ chuyển tiếp request từ 443 → 5000

# Kiểm tra trạng thái
sudo ufw status verbose
```

**Kết quả mong đợi:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

> [!CAUTION]
> **Tuyệt đối không mở port 5000 ra Internet!**  
> Backend chỉ nên lắng nghe trên `127.0.0.1:5000` (localhost).  
> Nginx sẽ là lớp bảo vệ duy nhất tiếp xúc với bên ngoài.

### 6.2. Bảo mật MongoDB

- **MongoDB Atlas:** Chỉ whitelist IP của Server (không dùng `0.0.0.0/0`)
- **MongoDB Local:** Bind `127.0.0.1` trong `/etc/mongod.conf`:
  ```yaml
  net:
    bindIp: 127.0.0.1
  ```

### 6.3. Bảo mật ứng dụng

| Hạng mục | Kiểm tra |
|----------|----------|
| File `.env` | Không commit lên Git (`đã có trong .gitignore`) |
| `WEBHOOK_SECRET` | Đặt chuỗi ngẫu nhiên dài ≥ 32 ký tự |
| `NODE_ENV` | Đặt `production` (ẩn stack trace lỗi) |
| CORS | Chỉ cho phép `FRONTEND_URL` (cần cấu hình trong `app.js`) |
| HTTPS | Bắt buộc — redirect HTTP → HTTPS qua Nginx |

### 6.4. Cập nhật định kỳ

```bash
# Cập nhật OS
sudo apt update && sudo apt upgrade -y

# Cập nhật dependencies (kiểm tra lỗ hổng)
cd /var/www/mapmanager/backend
npm audit

# Gia hạn SSL (tự động qua cron, nhưng kiểm tra thủ công)
sudo certbot renew --dry-run
```

---

## 📝 Checklist triển khai

Đánh dấu ✅ khi hoàn thành từng bước:

```
[ ] 1. Server đã cài Node.js 20.x, PM2, Nginx, Certbot
[ ] 2. Clone mã nguồn vào /var/www/mapmanager
[ ] 3. Tạo .env từ .env.example và điền đủ giá trị
[ ] 4. MongoDB Atlas đã tạo cluster + whitelist IP
[ ] 5. Google Cloud đã bật API + tạo OAuth Credentials
[ ] 6. Gemini API Key đã lấy
[ ] 7. Telegram Bot đã tạo + lấy Token + Chat ID
[ ] 8. npm install cho Backend và Frontend
[ ] 9. Frontend đã thay localhost:5000 → URL thật
[ ] 10. npm run build Frontend thành công
[ ] 11. PM2 đã chạy Backend (pm2 status = online)
[ ] 12. Nginx config đã tạo + test syntax OK
[ ] 13. SSL đã cấu hình qua Certbot
[ ] 14. /api/health trả về OK
[ ] 15. Telegram Webhook đã setWebhook thành công
[ ] 16. Google OAuth redirect URI đã cập nhật
[ ] 17. UFW Firewall đã bật (chỉ 22, 80, 443)
[ ] 18. Đăng nhập Frontend + kết nối Google thành công
[ ] 19. Cron Automation chạy bình thường (pm2 logs)
[ ] 20. Telegram nhận được alert khi có review mới
```

---

> [!TIP]
> **Lưu ý cuối cùng:** Sau khi triển khai xong, hãy chạy `pm2 logs mapmanager-api` và theo dõi trong 30 phút đầu tiên để đảm bảo Automation Service chạy đúng chu kỳ quét, review 4-5 sao tự động reply, và review 1-3 sao gửi alert về Telegram kèm bản nháp AI.
