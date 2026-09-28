# Tram Backend Cloud Deployment Guide

This guide provides step-by-step instructions to deploy your FastAPI backend to **Koyeb**, **Oracle Cloud Free**, or **Render**, and connect it to your Next.js frontend interface.

---

## Quick Comparison & Recommendation

| Feature | **Koyeb (Recommended)** 🏆 | **Oracle Cloud Free** 🚀 | **Render** ⚠️ |
| :--- | :--- | :--- | :--- |
| **Free Tier** | 512 MB RAM, 0.25 vCPU (Always active) | Up to 4 vCPUs, 24GB RAM (Always Free VM) | 512 MB RAM (Spins down after 15 min) |
| **WebSocket / Realtime** | Excellent (No timeouts) | Full root control (Unlimited) | Limited / Disconnects on idle |
| **Continuous Background Jobs** | ✅ Supported (Embedded scanner stays live) | ✅ Supported | ❌ Fails (Spins down when idle) |
| **Deployment Complexity** | Low (Automatic Docker / Git) | Medium (SSH + Docker Setup) | Low (Git push) |

> **Recommendation**: Choose **Koyeb** for easiest zero-cost deployment with continuous background scanner running. Choose **Oracle Cloud** if you want maximum compute power and dedicated IP control.

---

## Option 1: Deploy to Koyeb (Recommended)

### Step 1: Push Project to GitHub
1. Make sure your latest project changes are committed and pushed to your GitHub repository:
   ```bash
   git add .
   git commit -m "Add Dockerfile and backend deployment configuration"
   git push origin main
   ```

### Step 2: Create Koyeb App
1. Go to [koyeb.com](https://www.koyeb.com) and log in / create an account.
2. Click **Create Service**.
3. Select **GitHub** as the source.
4. Select your `Tram-Alpha` repository.
5. Set the **Work Directory** to `backend`.
6. Select **Dockerfile** as the build method (it will automatically pick up `backend/Dockerfile`).
7. In **Environment Variables**, add:
   - `APP_ENV`: `production`
   - `APP_DEBUG`: `false`
   - `CORS_ORIGINS`: `*` (or your frontend domain like `https://your-app.vercel.app`)
   - `SUPABASE_URL`: `https://upvvjuxgmoceiaijhkzp.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY`: `your-service-role-key`
   - `SUPABASE_JWT_SECRET`: `your-jwt-secret`
   - `BINANCE_API_KEY`: `(optional)`
   - `BINANCE_API_SECRET`: `(optional)`
   - `TELEGRAM_BOT_TOKEN`: `(optional)`
   - `TELEGRAM_CHAT_ID`: `(optional)`
8. Set **Port** to `8000`.
9. Click **Deploy**. Koyeb will build the container and provide your public URL (e.g. `https://tram-backend-xxx.koyeb.app`).

---

## Option 2: Deploy to Oracle Cloud Free Tier (VPS)

### Step 1: Create Compute Instance
1. Log into your Oracle Cloud Console.
2. Go to **Instances** -> **Create Instance**.
3. Select **Canonical Ubuntu 22.04 / 24.04** or **Oracle Linux**.
4. Choose **VM.Standard.A1.Flex** (Ampere ARM, 2 to 4 OCPUs, 12GB to 24GB RAM) or **VM.Standard.E2.1.Micro**.
5. Save your SSH private key and create the instance.

### Step 2: Configure Firewall & Install Docker
Connect via SSH to your instance:
```bash
ssh -i your-key.key ubuntu@<YOUR_INSTANCE_IP>
```

Open port 8000 and 80/443 in iptables / ufw:
```bash
sudo ufw allow 8000/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Install Docker & Docker Compose:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker
```

### Step 3: Deploy with Docker Compose
1. Clone your repository:
   ```bash
   git clone https://github.com/your-username/Tram-Alpha.git
   cd Tram-Alpha
   ```
2. Create `.env` file in the project root:
   ```env
   SUPABASE_URL=https://upvvjuxgmoceiaijhkzp.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_JWT_SECRET=your-jwt-secret
   ```
3. Start the application:
   ```bash
   docker compose up -d --build
   ```
Your backend will be live at `http://<YOUR_INSTANCE_IP>:8000`.

---

## Option 3: Deploy to Render

1. Log in to [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set **Root Directory** to `backend`.
5. Environment: **Docker** or **Python**.
6. Build Command: `pip install .`
7. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
8. Add Environment Variables (Same as Koyeb).
9. Click **Create Web Service**.

---

## Step 4: Connecting the Frontend Interface to Cloud Backend

Now that your backend is deployed live at a cloud URL (e.g. `https://tram-backend-xxx.koyeb.app`):

### 1. In Local Development:
Update `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://upvvjuxgmoceiaijhkzp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://tram-backend-xxx.koyeb.app
```

### 2. In Production (Vercel / Netlify / Cloudflare Pages):
In your frontend hosting platform environment settings, add:
- `NEXT_PUBLIC_API_URL`: `https://tram-backend-xxx.koyeb.app`

### 3. Verify Connection:
- Test your backend health endpoint in browser or curl:
  `https://tram-backend-xxx.koyeb.app/api/health`
  Response: `{"status": "ok", ...}`
- Open your frontend app interface. Signals, strategy scanner, trade logs, and settings will connect smoothly over HTTPS.
