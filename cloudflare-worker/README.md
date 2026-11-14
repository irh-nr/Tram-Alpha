# Cloudflare Worker Reverse Proxy for Binance

Panduan ini digunakan jika jaringan Anda (seperti WiFi kampus **eduroam**, kantor, atau ISP) memblokir akses ke Binance (`api.binance.com` atau port WebSocket `9443`).

Dengan menggunakan Cloudflare Worker gratis, semua request dari backend Anda akan dikirim ke Cloudflare (`*.workers.dev`), lalu Cloudflare yang meneruskannya ke Binance melalui port standar 443 (HTTPS/WSS).

---

## Cara Deploy (2 Menit via Browser — Gratis)

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/) dan login (atau daftar akun gratis).
2. Di sidebar kiri, klik **Workers & Pages** > **Overview**.
3. Klik tombol **Create Application** lalu pilih **Create Worker**.
4. Beri nama worker Anda, misalnya: `binance-proxy`, lalu klik **Deploy**.
5. Setelah terdeploy, klik **Edit code** (Quick Edit).
6. Hapus seluruh isi kode default, lalu salin dan tempel kode dari file [`worker.js`](worker.js).
7. Klik tombol **Save and Deploy**.
8. Salin URL Worker Anda yang berakhiran `.workers.dev`, contohnya:
   ```text
   https://binance-proxy.username.workers.dev
   ```

---

## Konfigurasi di Backend Tram

Buka file `backend/.env`, lalu ubah / tambahkan:

```env
BINANCE_REST_BASE_URL=https://binance-proxy.username.workers.dev/api/v3
BINANCE_WS_BASE_URL=wss://binance-proxy.username.workers.dev/stream
```

*(Ganti `binance-proxy.username.workers.dev` dengan URL worker Anda)*.

Selesai! Sekarang backend Tram akan berkomunikasi dengan Binance melalui Cloudflare Worker.

---

## Solusi Alternatif Tanpa Deploy

Selain Cloudflare Worker, Anda juga memiliki opsi lain:

### 1. Binance Vision Mirror (Paling Cepat — Tanpa Setup Apapun)
Binance menyediakan domain mirror resmi khusus market data publik yang biasanya tidak diblokir oleh eduroam:
Di `backend/.env`:
```env
BINANCE_REST_BASE_URL=https://data-api.binance.vision/api/v3
BINANCE_WS_BASE_URL=wss://data-stream.binance.vision/stream
```

### 2. Cloudflare WARP (1.1.1.1)
Download dan install aplikasi gratis **Cloudflare WARP** dari [1.1.1.1](https://1.1.1.1/).
Cukup aktifkan (Connect), maka seluruh koneksi internet laptop Anda akan dienkripsi dan melewati firewall eduroam tanpa perlu ubah setting kode.

### 3. Local Proxy (Clash / v2ray / Shadowsocks)
Jika Anda memiliki aplikasi proxy lokal:
```env
BINANCE_PROXY_URL=http://127.0.0.1:7890
```

