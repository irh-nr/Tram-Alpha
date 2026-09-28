# Tram Backend Cloud Deployment Guide (Render Focus)

This guide provides step-by-step instructions to deploy your FastAPI backend to **Render** (with Keep-Alive Cronjob), **Koyeb**, or **Oracle Cloud Free**, and connect it to your Next.js frontend interface.

---

## ⚡ Important: Render 750-Hour Free Limit & Keep-Alive Analysis

### 1. Will the Keep-Alive Cronjob exceed Render's 750 Free Hours Cap?
* **NO! You are completely safe.**
* Render provides **750 free instance runtime hours per calendar month** per account.
* A single Web Service running 24 hours per day for 31 days consumes:
  $$\text{Hours} = 24 \times 31 = 744 \text{ hours/month}$$
* $744 \text{ hours} \le 750 \text{ hours limit}$.
* Therefore, **one single backend web service running 24/7 on Render stays 100% free**.

### 2. Does direct Frontend calling interfere or waste hours?
* **NO!** Render measures **instance clock time**, NOT the number of HTTP requests or bandwidth.
* Whether your Next.js frontend sends 1 request or 100,000 requests to your Render backend, the server is running anyway. It consumes the exact same 1 hour of clock time per hour.
* **Important Rule**: Deploy your Next.js frontend on **Vercel**, **Netlify**, or **Cloudflare Pages** (all 100% free). Do NOT deploy the frontend as a 2nd Web Service on Render, because two Web Services would consume $744 \times 2 = 1,488 \text{ hours}$ and exceed the 750-hour cap.

---

## 🚀 Option 1: Deploy to Render (with Keep-Alive Cronjob)

### Step 1: Push Project to GitHub
1. Make sure all latest project changes are committed and pushed to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure backend for Render deployment"
   git push origin main
   ```

### Step 2: Create Render Web Service
1. Log in to [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`Tram-Alpha`).
4. Set the following fields:
   * **Name**: `tram-backend`
   * **Root Directory**: `backend`
   * **Language**: `Docker` (Render will automatically detect `backend/Dockerfile`)
     *(Alternatively, select `Python 3` with Build Command: `pip install .` and Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`)*
   * **Instance Type**: `Free`
5. Under **Environment Variables**, click **Add Environment Variable**:
   * `APP_ENV`: `production`
   * `APP_DEBUG`: `false`
   * `CORS_ORIGINS`: `*` *(or your Vercel URL e.g. `https://your-tram-frontend.vercel.app`)*
   * `SUPABASE_URL`: `https://upvvjuxgmoceiaijhkzp.supabase.co`
   * `SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   * `SUPABASE_SERVICE_ROLE_KEY`: `your-supabase-service-role-key`
   * `SUPABASE_JWT_SECRET`: `your-supabase-jwt-secret`
   * `BINANCE_API_KEY`: *(optional)*
   * `BINANCE_API_SECRET`: *(optional)*
   * `TELEGRAM_BOT_TOKEN`: *(optional)*
   * `TELEGRAM_CHAT_ID`: *(optional)*
6. Click **Create Web Service**.
7. Note your public URL once deployed (e.g., `https://tram-backend.onrender.com`).

---

### Step 3: Setup Free Keep-Alive Cronjob (Prevents 15-Min Sleeping)

Render free services spin down after 15 minutes of HTTP inactivity. Setting up a free keep-alive cronjob ensures your **Binance WebSocket Scanner** remains active 24/7.

#### **Using Cron-Job.org (Recommended - 100% Free)**
1. Go to [cron-job.org](https://cron-job.org/) and create a free account.
2. Click **Console** -> **Create Cronjob**.
3. Set **Title**: `Tram Backend Keepalive`
4. Set **URL**: `https://tram-backend.onrender.com/api/health`
5. Set **Execution Schedule**: `Every 10 minutes` (or every 12 minutes).
6. Click **Create**.

#### **Alternative: Using UptimeRobot**
1. Go to [uptimerobot.com](https://uptimerobot.com/) and register.
2. Click **Add New Monitor**.
3. Monitor Type: **HTTP(s)**.
4. Friendly Name: `Tram Backend`.
5. URL: `https://tram-backend.onrender.com/api/health`.
6. Monitoring Interval: `5 minutes` or `10 minutes`.
7. Click **Create Monitor**.

Now, every 10 minutes, the cron service will ping `/api/health`. Render sees continuous traffic and will **never spin down**!

---

## ⚡ Option 2: Deploy to Koyeb

1. Log in to [koyeb.com](https://www.koyeb.com).
2. Click **Create Service** -> **GitHub**.
3. Select `Tram-Alpha`, set Work Directory to `backend`, Builder: `Dockerfile`.
4. Add environment variables & port `8000`. Click **Deploy**.

---

## 🖥️ Option 3: Deploy to Oracle Cloud Free Tier (VPS)

1. Create a free Ubuntu instance on Oracle Cloud Console.
2. SSH into instance, open port 8000 via UFW, install Docker & Docker Compose.
3. Run `docker compose up -d --build` using root [docker-compose.yml](file:///d:/_irhamna/project/Tram/Tram-Alpha-main/docker-compose.yml).

---

## 🔗 Step 4: Connecting Frontend Interface to Render Backend

### 1. In Local Frontend Development (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=https://upvvjuxgmoceiaijhkzp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://tram-backend.onrender.com
```

### 2. In Production Frontend (Vercel / Netlify):
Add Environment Variable in your hosting dashboard:
* Key: `NEXT_PUBLIC_API_URL`
* Value: `https://tram-backend.onrender.com`

### 3. Verification Checklist:
1. Test in browser: `https://tram-backend.onrender.com/api/health`
   * Should output: `{"status":"healthy","version":"0.1.0","environment":"production"}`
2. Check scanner status: `https://tram-backend.onrender.com/api/scanner/status`
3. Launch frontend interface — signals, scanner, and trade journals will communicate cleanly with your Render backend over SSL.
