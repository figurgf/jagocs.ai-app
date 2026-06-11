# 🤖 CS AI Platform — Web App

Platform CS AI lengkap siap deploy: **Frontend (Vercel)** + **Backend (Railway)**

```
cs-ai-app/
├── frontend/    → Deploy ke Vercel  (React + Vite)
└── backend/     → Deploy ke Railway (Node.js + Express)
```

---

## 🚀 Panduan Deploy Lengkap

### LANGKAH 1 — Upload ke GitHub

Kedua folder harus di-upload ke GitHub (masing-masing repo atau satu repo).

```bash
# Inisialisasi git di root folder
cd cs-ai-app
git init
git add .
git commit -m "first commit"

# Buat repo baru di github.com, lalu:
git remote add origin https://github.com/USERNAME/cs-ai-app.git
git push -u origin main
```

---

### LANGKAH 2 — Deploy Backend ke Railway

1. Buka [railway.app](https://railway.app) → **Login with GitHub**
2. Klik **New Project → Deploy from GitHub repo**
3. Pilih repo kamu → pilih folder **`backend`** sebagai root
4. Railway otomatis detect Node.js dan mulai build

**Set Environment Variables di Railway:**

Buka project → **Variables** → tambahkan satu per satu:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-xxxxx` |
| `FONNTE_TOKEN` | Token dari fonnte.com |
| `META_ACCESS_TOKEN` | Token dari Meta Developers |
| `META_PHONE_NUMBER_ID` | Phone Number ID dari Meta |
| `META_VERIFY_TOKEN` | Bebas, contoh: `csai_verify_2024` |
| `META_API_VERSION` | `v19.0` |
| `AI_SYSTEM_PROMPT` | Instruksi bot kamu |
| `FRONTEND_URL` | *(isi setelah deploy frontend)* |

5. Setelah deploy, salin **URL Railway** kamu (contoh: `https://cs-ai-backend.up.railway.app`)

---

### LANGKAH 3 — Deploy Frontend ke Vercel

1. Buka [vercel.com](https://vercel.com) → **Login with GitHub**
2. Klik **New Project → Import** repo kamu
3. Pilih folder **`frontend`** sebagai **Root Directory**
4. Framework: **Vite** (otomatis terdeteksi)

**Set Environment Variables di Vercel:**

Buka project → **Settings → Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_BACKEND_URL` | URL Railway dari Langkah 2 |

5. Klik **Deploy**
6. Salin **URL Vercel** kamu (contoh: `https://cs-ai-platform.vercel.app`)

---

### LANGKAH 4 — Hubungkan Frontend ↔ Backend

Kembali ke Railway → **Variables** → update:
```
FRONTEND_URL = https://cs-ai-platform.vercel.app
```

Lalu **Redeploy** backend agar CORS terupdate.

---

### LANGKAH 5 — Setup Webhook

**Fonnte:**
- Login fonnte.com → Device → Edit → Webhook URL:
  ```
  https://cs-ai-backend.up.railway.app/webhook/fonnte
  ```

**Meta Cloud API:**
- Meta App Dashboard → WhatsApp → Configuration → Webhook:
  - Callback URL: `https://cs-ai-backend.up.railway.app/webhook/meta`
  - Verify Token: sama dengan `META_VERIFY_TOKEN` di Railway

---

## ✅ Cek Semua Berjalan

```bash
# Cek backend
curl https://cs-ai-backend.up.railway.app/health

# Response yang diharapkan:
# { "status": "ok", "config": { "fonnte": true, "meta": true, "claude": true } }
```

Buka URL Vercel di browser → CS AI Platform siap digunakan! 🎉

---

## 🔄 Update Aplikasi

Setiap kali push ke GitHub, Vercel dan Railway otomatis redeploy.

```bash
git add .
git commit -m "update fitur"
git push
```

---

## 💡 Tips

- **Domain custom gratis**: Vercel beri subdomain `*.vercel.app`, Railway beri `*.up.railway.app`
- **Railway free tier**: 500 jam/bulan — cukup untuk testing. Upgrade $5/bulan untuk produksi
- **Vercel free tier**: Unlimited untuk project personal
- **Monitoring**: Cek logs di Railway dashboard untuk debug webhook

---

## 📞 Referensi

- [Vercel Docs](https://vercel.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Fonnte Docs](https://docs.fonnte.com)
- [Meta Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
