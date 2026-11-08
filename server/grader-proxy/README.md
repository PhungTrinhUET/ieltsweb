# Proxy AI (Cloudflare Worker)

App gọi Claude để chấm Writing/Speaking, dịch, tra từ và sinh đề. Có 2 cách:

1. **API key cá nhân** – nhập trong *Cài đặt → AI*. Key lưu trên thiết bị, gọi thẳng `api.anthropic.com`.
2. **Proxy (thư mục này)** – key nằm trên máy chủ, người dùng chỉ cần địa chỉ proxy + mã truy cập. Hợp khi chia sẻ app cho người khác.

```bash
cd server/grader-proxy
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ACCESS_CODE
npx wrangler deploy          # → https://ielts-grader.<tài-khoản>.workers.dev
```

Trong app: *Cài đặt → AI → Qua proxy*, nhập địa chỉ + mã, bấm **Kiểm tra kết nối**.

- Chỉ chuyển tiếp `POST /v1/messages` và các model trong `ALLOWED_MODELS` (wrangler.toml). App dùng model chính để chấm/sinh đề và model nhẹ (mặc định Haiku) để dịch/tra từ – nhớ cho phép cả hai.
- Giới hạn origin bằng `ALLOWED_ORIGINS`; đặt spend limit cho key trong Anthropic Console.
