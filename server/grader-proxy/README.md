# Proxy AI (Cloudflare Worker)

App gọi AI để chấm Writing/Speaking, dịch, tra từ và sinh đề. Có 2 cách:

1. **Key của tôi**: chọn nhà cung cấp (Claude, DeepSeek, OpenAI, Gemini, OpenRouter, hoặc dịch vụ OpenAI-compatible tuỳ chỉnh) trong *Cài đặt → AI* rồi dán key. Key lưu trên thiết bị và gửi thẳng tới nhà cung cấp.
2. **Proxy (thư mục này)**: key nằm trên máy chủ. Người dùng chỉ cần địa chỉ proxy và một mã truy cập; mỗi mã có giới hạn lượt mỗi ngày. Cách này hợp khi chia sẻ app cho học viên.

## Dựng

```bash
cd server/grader-proxy
npx wrangler login
npx wrangler kv namespace create USAGE        # dán id vào wrangler.toml (khối [[kv_namespaces]])
npx wrangler secret put ANTHROPIC_API_KEY     # nếu dùng Claude
npx wrangler secret put COMPAT_API_KEY        # nếu dùng DeepSeek/OpenAI/Gemini/OpenRouter (COMPAT_BASE_URL trong wrangler.toml)
npx wrangler secret put ACCESS_CODES          # vd. lop-a,lop-b,thay-giao:200
npx wrangler deploy                           # → https://ielts-grader.<tài-khoản>.workers.dev
```

Trong app: *Cài đặt → AI*, chọn đúng nhà cung cấp, chọn **Qua proxy (mã truy cập)**, nhập địa chỉ và mã, rồi bấm **Kiểm tra kết nối**.

## Biến

| Biến | Loại | Ý nghĩa |
|---|---|---|
| `ANTHROPIC_API_KEY` | secret | Key Claude, dùng cho `POST /v1/messages` |
| `COMPAT_BASE_URL` | var | Base URL OpenAI-compatible, vd. `https://api.deepseek.com`, `https://api.openai.com/v1`, `https://generativelanguage.googleapis.com/v1beta/openai`, `https://openrouter.ai/api/v1` |
| `COMPAT_API_KEY` | secret | Key của dịch vụ ở trên, dùng cho `POST /v1/chat/completions` |
| `ACCESS_CODES` | secret | Mã truy cập, phân tách dấu phẩy. `mã:số` đặt giới hạn riêng cho mã đó. Bỏ trống thì ai biết địa chỉ cũng gọi được |
| `DAILY_LIMIT` | var | Lượt mỗi mã mỗi ngày (theo giờ UTC), mặc định 30; `0` = không giới hạn |
| `USAGE` | KV | Nơi đếm lượt. Không gắn KV thì không giới hạn được |
| `ALLOWED_MODELS` | var | Model được phép. App dùng một model chính (chấm, sinh đề) và một model nhẹ (dịch, tra từ), nên cần cho phép cả hai |
| `ALLOWED_ORIGINS` | var | Origin được gọi, `*` = mọi nơi |

- Mỗi lần chấm bài hoặc dịch tính 1 lượt. Hết lượt, proxy trả 429 và app báo "Đã hết hạn mức". Response có header `x-usage-today` / `x-usage-limit`.
- Bộ đếm KV là eventually consistent, nên khi nhiều người gọi cùng lúc, số lượt có thể vượt giới hạn vài lần. Hãy đặt thêm spend limit ở trang của nhà cung cấp.
- Mã cũ `ACCESS_CODE` (một mã) vẫn được nhận.
