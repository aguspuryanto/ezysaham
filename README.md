# EzySaham (Next.js)

Website pendamping aplikasi mobile EzySaham: screener saham BEI, chart candlestick + indikator, portofolio, dan tips untuk pemula. Dibangun mengikuti `PLAN.txt`.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Salin `.env.example` ke `.env.local` untuk mengisi key Supabase (opsional).

## Login (magic link) & portofolio di Supabase

Tanpa env Supabase, website tetap berjalan dalam mode tamu (portofolio di localStorage, tombol Masuk disembunyikan).

1. Buat project di https://supabase.com, lalu isi `.env.local` (lihat `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Restart `npm run dev`.
2. **SQL Editor** → jalankan `supabase/migrations/0001_portfolio_holdings.sql`.
3. **Authentication → URL Configuration**
   - Site URL: `https://ezysaham.vercel.app` (domain produksi)
   - Redirect URLs: `https://ezysaham.vercel.app/auth/callback` dan `http://localhost:3000/auth/callback`
     (alamat yang tidak terdaftar ditolak dan diganti Site URL)
4. **Authentication → Sign In / Providers → Email**: pastikan aktif (default).
5. *(Disarankan)* **Authentication → Emails → Templates → Magic Link**, ganti link menjadi
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
   - `{{ .RedirectTo }}` mengikuti asal permintaan (localhost saat dev, domain produksi saat live), jadi satu template berlaku untuk keduanya.
   - Format `token_hash` membuat link bisa dibuka di perangkat/browser lain (template bawaan memakai PKCE yang harus dibuka di browser yang sama).
   - Jangan pakai `{{ .SiteURL }}` di sini: link akan selalu mengarah ke Site URL walau login diminta dari localhost.
6. *(Produksi)* **Project Settings → Authentication → SMTP**: pasang SMTP sendiri (mis. Resend). SMTP bawaan Supabase dibatasi beberapa email per jam.

Alur: `/login` → email berisi link → `/auth/callback` memverifikasi → valid: redirect ke `/`, tidak valid/kedaluwarsa: kembali ke `/login` dengan pesan error.
Setelah login pertama, holding yang tersimpan di localStorage ditawarkan untuk diimpor ke akun.

## Membership Pro (DOKU Checkout)

Paket Pro bersifat sukarela: bayar sekali per periode (1 bulan / 1 tahun) lewat **DOKU Checkout**, tanpa auto-debit.
Selama env di bawah belum lengkap, tombol bayar di `/harga` tetap nonaktif.

1. **Supabase → SQL Editor** → jalankan `supabase/migrations/0002_memberships.sql` (tabel `memberships`, `payments`, fungsi `activate_membership`).
2. **Supabase → Project Settings → API Keys** → salin *secret key* ke `SUPABASE_SECRET_KEY` (server only).
3. **DOKU Back Office** (mulai di sandbox: https://dashboard-sandbox.doku.com):
   - Aktifkan produk **DOKU Checkout** dan metode pembayaran yang diinginkan (QRIS, VA, e-wallet, kartu).
   - Salin **Client ID** → `DOKU_CLIENT_ID` dan **Secret Key** → `DOKU_SECRET_KEY`.
   - Atur **Notification URL** → `https://ezysaham.vercel.app/api/webhooks/doku` (path harus persis `/api/webhooks/doku`).
4. Isi env di `.env.local` dan **Vercel → Environment Variables** (`DOKU_ENV=sandbox` dulu), lalu redeploy.
5. Uji: login → `/harga` → *Dukung dengan Pro* → bayar di https://sandbox.doku.com/integration/simulator/ →
   kembali ke `/harga?status=return` → status "Pro aktif sampai …".
6. Produksi: ganti ke Client ID/Secret Key produksi dan `DOKU_ENV=production`.

Alur: `/api/checkout` (buat sesi DOKU, harga dari server) → halaman bayar DOKU →
- HTTP Notification `/api/webhooks/doku`: verifikasi signature HMAC-SHA256 (Request-Target = path notifikasi, Digest = SHA-256 body) → `activate_membership`
- Cadangan: saat user kembali, `/api/payments/sync` mengecek status ke API DOKU (`/orders/v1/status/{invoice}`)

`activate_membership` atomik & idempoten (aman bila notifikasi dikirim ulang) dan memvalidasi jumlah bayar.
Invoice diberi prefix `EZS` agar notifikasi milik aplikasi lain di akun DOKU yang sama diabaikan.
Harga & fitur paket: `src/lib/plans.ts`.

## Struktur

```
src/app/(dashboard)/          page.tsx (Pasar), screener/, stock/[symbol]/, portfolio/, news/
src/app/api/stocks/...        BFF untuk browser (stocks, history, fundamentals)
src/lib/sources/              pasardana.ts, yahoo.ts (pengambil data dari sumber asli)
src/components/               ui/, layout/, dashboard/, charts/, portfolio/
src/lib/                      api.ts, indicators.ts, screener.ts, dividends.ts, types.ts, format.ts, articles.ts
src/hooks/                    usePortfolio.ts (localStorage), useStockList.ts
```

## Catatan data

- Data diambil langsung dari sumbernya: daftar saham dari Pasardana, history/indeks/kurs/fundamental dari Yahoo Finance (`src/lib/sources/`). Tidak bergantung pada ezysaham.vercel.app.
- Cache: daftar saham 5 menit, history 10 menit, indeks 15 menit, fundamental 6 jam.
- Dividend yield hanya ada di endpoint fundamentals, jadi **Top Dividen** dihitung dari 40 saham berkapitalisasi terbesar.
- **Top Akumulasi** memakai heuristik: harga sideways (±5% sebulan, ±3% sepekan), transaksi ramai, dan harga ditutup dekat high harian.
