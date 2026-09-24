Platform Analisis Saham Indonesia Anda Butuhkan
Dapatkan data real-time, indikator teknikal lanjutan, screener cerdas, dan sentimen pasar dalam satu dashboard intuitif.

Fitur Unggulan Sahamflix
Didukung oleh data finansial premium bertaraf institusi, kami menyediakan data terlengkap untuk analisis Anda.

Real-time Market Data
Pantau harga saham, volume perdagangan, dan pergerakan pasar Bursa Efek Indonesia secara instan tanpa delay.

Indikator Teknikal Otomatis
Dapatkan perhitungan langsung untuk RSI, MACD, dan Moving Average tanpa perlu mengatur chart manual.

Data Historis Komprehensif
Akses data riwayat harga saham bertahun-tahun ke belakang untuk backtesting dan analisis tren jangka panjang.

Analisis Fundamental
Cek kesehatan perusahaan dengan metrik penting seperti Market Cap, PER, PBV, dan ROE dalam satu layar.

Data Sektoral & Subsektoral
Pantau rotasi sektor dan temukan peluang di subsektor industri spesifik yang sedang bertumbuh.

Berita & Sentimen Pasar
Tetap up-to-date dengan berita keuangan terbaru yang berdampak langsung pada pergerakan harga saham.

Antarmuka yang Elegan & Intuitif
Nikmati pengalaman analisis saham dengan desain modern yang dirancang untuk kemudahan penggunaan maksimal.

Dashboard Real-time
Monitor semua watchlist dan screener dalam satu layar

Interactive Charts
Analisis dengan chart interaktif dan indikator teknikal

Screener Pro
Filter saham berdasarkan kriteria fundamental & teknikal

Market Movers
Lihat saham top gainers dan losers sepanjang hari

News & Sentiment
Berita terkurasi dan analisis sentimen pasar real-time

Bandarmologi
Analisis pergerakan dana investor besar (asing & lokal)

---
Mulai Gratis, Upgrade Kalau Cocok
Daftar dan langsung pakai tanpa bayar. Tidak ada masa percobaan yang habis — akun gratis tetap gratis selamanya.

GRATIS SELAMANYA
Rp 0
Tanpa kartu kredit, tanpa batas waktu.

✓ Ringkasan Pasar
✓ Data Pasar
✓ Pasar Global
✓ Market Mover
✓ Screener Pro
✓ Analisis Broker
🔒 Data Emiten
🔒 Bandarmologi
🔒 Peluang Ritel
dan 10 fitur premium lainnya


MEMBER PRO
Rp 99.000
Satu kali bayar. Akses seumur hidup.

✓ Semua yang ada di paket gratis
✓ Data Emiten
✓ Bandarmologi
✓ Peluang Ritel
✓ Analitik Lanjut
✓ Uptrend Power
✓ Stochastic GC
✓ Bullish Engulfing
✓ Fair Value Gap
✓ Bull Parade
✓ Early Trend Catcher
✓ ARA Detector
✓ Giant Wave
✓ Asset 

## Sidebar
Pasar
- Ringkasan Pasar
- Data Pasar
- Data Emiten

Analisis
- Analisis Broker
- Bandarmologi
- Peluang Ritel
- Analitik Lanjut
- Pasar Global
- Market Mover

Screener Andalan
- Screener Pro
- ARA Detector
- Giant Wave
- Uptrend Power
- Stochastic GC
- Bullish Engulfing
- Fair Value Gap
- Bull Parade
- Early Trend Catcher
- Asset Play

Sistem
Panduan Pengguna -> https://sahamflix.com/docs

---

## Rencana Implementasi Membership

### Context
`features_membership.md` menggambarkan model **Gratis selamanya** + **Member Pro Rp 99.000 sekali bayar, akses seumur hidup**. Saat ini app belum punya fondasinya:
- **Login:** `next-auth@5.0.0-beta.32` terpasang + env `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET` ada, tapi `src/app/api/auth/[...nextauth]/` kosong. Sisa kode Supabase lama hanya stub (`useAuthUser.ts` selalu `null`, `auth/callback/route.ts` di-comment). Layout sudah punya slot `{/* <AuthSessionProvider> */}` yang file-nya belum ada.
- **Database:** tidak ada. Hanya Vercel Blob (`JournalRepository.ts`, satu file jurnal dipakai bersama semua pengunjung). Watchlist/settings di localStorage.
- **Pembayaran:** tidak ada.
- **Next.js 16.2.10** (middleware = `proxy.ts`), host Vercel (project "ezysaham").

Keputusan yang dipilih: **NextAuth v5 (Google + Email magic link)**, **Neon Postgres + Drizzle**, **Midtrans Snap**. Permintaan saat ini: **rencana saja** — implementasi menyusul per fase setelah disetujui.


---

### Arsitektur

```
Browser ──► proxy.ts (cek sesi untuk halaman Pro)
   │
   ├─ SessionProvider + useMembership()  ──► <ProGate feature="…"> (blur + CTA Upgrade)
   │
   └─ /api/*  ──► auth() + requireFeature()  ──► data berbayar (broker summary, jurnal per-user)
                                   │
Neon Postgres (Drizzle): users(+plan) · accounts · sessions · verification_tokens · orders
                                   ▲
Midtrans Snap ──webhook──► /api/payments/midtrans/notification ──► users.plan = 'pro'
```

Prinsip: **UI gating untuk UX, server gating untuk keamanan.** Data yang mahal/berbayar (Index Alpha broker summary, jurnal) wajib dicek di API, bukan hanya disembunyikan di UI.

---

### Fase 0 — Bersih-bersih (kecil)
- Hapus stub Supabase: `src/app/auth/callback/route.ts`, isi `useAuthUser.ts` diganti hook NextAuth.
- Hapus env Supabase dari `.env` (`NEXT_PUBLIC_SUPABASE_*`) bila tidak dipakai lagi.
- Buat `.env.example` berisi **nama** variabel saja.

### Fase 1 — Login + Database
**Dependensi:** `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@auth/drizzle-adapter`, (email) `resend`.
**Provision:** Neon via Vercel Marketplace (`vercel integration add neon`) → `DATABASE_URL` otomatis; `vercel env pull`.

File baru:
- `src/data/db/schema.ts` — tabel NextAuth standar (`users`, `accounts`, `sessions`, `verification_tokens`) + kolom tambahan di `users`: `plan: 'free' | 'pro'` (default `free`), `proSince`, `role: 'user' | 'admin'`. Tabel `orders` (lihat Fase 4).
- `src/data/db/client.ts` — Drizzle + Neon serverless.
- `drizzle.config.ts` + migrasi (`drizzle-kit generate/migrate`).
- `src/auth.ts` — NextAuth v5: `providers: [Google, Resend({ from: EMAIL_FROM })]`, `adapter: DrizzleAdapter(db)`, `session.strategy = 'database'`, callback `session` menambahkan `user.id`, `user.plan`, `user.role`.
- `src/app/api/auth/[...nextauth]/route.ts` — `export const { GET, POST } = handlers`.
- `src/presentation/features/auth/AuthSessionProvider.tsx` — `'use client'` wrapper `SessionProvider` (mengisi slot yang sudah di-comment di `src/app/layout.tsx`).
- `src/app/masuk/page.tsx` — halaman login (tombol Google + input email).
- Perbarui `AuthButton.tsx` & `TerminalHeader.tsx` (sudah memakai `useAuthUser`) → `useSession()`: avatar, badge **PRO**, menu Akun/Keluar.

Env baru: `DATABASE_URL`, `AUTH_RESEND_KEY`, `EMAIL_FROM` (+ yang sudah ada `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`). Tambahkan redirect URI Google untuk domain produksi & preview.

### Fase 2 — Entitlement (satu sumber kebenaran)
- `src/domain/membership/entitlements.ts`
  - `type Plan = 'free' | 'pro'`
  - `type Feature = 'bandarmologi' | 'dataEmiten' | 'analitikLanjut' | 'positionMode' | 'premiumScreeners' | 'backtest' | 'jurnalCloud' | 'terminal' | …`
  - `FEATURE_PLAN: Record<Feature, Plan>` + `FEATURE_META` (label, deskripsi untuk kartu Pricing)
  - `hasFeature(plan, feature)` — fungsi murni, dipakai client & server.
- `src/presentation/features/membership/useMembership.ts` — `{ plan, isPro, status, can(feature) }` dari `useSession()`.
- `src/presentation/features/membership/ProGate.tsx` — render anak bila boleh; bila tidak: preview blur/terpotong + gembok + CTA "Upgrade ke Pro" (→ `/harga`) / "Masuk" bila belum login. Varian `inline` (baris/chip) dan `card`.
- `src/lib/auth/requireFeature.ts` — helper server untuk route handler: `401` belum login, `403` bukan Pro.
- `proxy.ts` — hanya untuk halaman yang seluruhnya Pro (mis. `/backtest`, `/terminal`, `/jurnal`): redirect ke `/masuk?next=…` / `/harga`. Matcher sempit agar halaman publik & SEO tidak terpengaruh.

### Fase 3 — Pemetaan fitur existing (Gratis vs Pro)
Mengikuti semangat md: fitur pasar dasar gratis, alat analisis mendalam Pro.

| Area (kode saat ini) | Gratis | Pro |
|---|---|---|
| Screener `/` (`ScreenerPage.tsx` `FILTER_ITEMS`) | Semua, Day Trading, Fundamental | Swing Hunter, High Growth, Core Portofolio + preset tersembunyi yang diaktifkan: Bandar Detector, Early Accumulation, ARA Hunter, Breakout Hunter, Trading Plan, Swing Trend/Momentum |
| Market Mover `/gainers` `/losers`, Sektor `/sektor`, IHSG | ✓ | ✓ |
| Analisis saham `/screener/[ticker]` — chart, berita | ✓ | ✓ |
| Equity Research v5 | Market State + Entry Mode (keputusan & alasan) | Buy Trigger lengkap + Action Plan (SL/TP), **Position Mode**, 6 komponen detail |
| Fundamental tab + 3 Pilar + Fair Value (Data Emiten) | Ringkasan skor | Detail rasio, valuasi, area akumulasi |
| Bandarmologi (`BandarDetectorCard`, `BrokerActivityPanel`, `/api/stocks/[code]/broker-summary`) | — | ✓ (**gate di API** — memakai `INDEX_ALPHA_API_KEY`) |
| Compare `/compare`, History `/history/[code]` (Analitik Lanjut) | 1× per hari / terbatas | ✓ |
| Backtest `/backtest`, Terminal `/terminal` | — | ✓ |
| Jurnal `/jurnal` | lokal (browser) | tersimpan di cloud per user |

Cara menerapkan:
- `ScreenerPreset` (`src/domain/screener/presets.ts`) ditambah `tier: Plan`; `PresetTabs.tsx` & `BottomNav.tsx` menampilkan gembok untuk preset Pro, `handleSelectFilter` membuka modal upgrade.
- Kartu di `StockAnalysisPage.tsx` dibungkus `<ProGate feature="…">` (v5 dipecah: bagian gratis tetap tampil, bagian Pro di-gate; toggle "Sudah punya saham" → gated `positionMode`).
- `JournalRepository.ts` diubah dari satu Blob bersama → tabel `journal_entries(userId, …)` di Postgres (sekaligus memperbaiki masalah jurnal dipakai bersama).

### Fase 4 — Pembayaran Midtrans Snap (Rp 99.000 sekali bayar)
- Tabel `orders`: `id` (order_id unik, mis. `EZY-<userId>-<ts>`), `userId`, `amount`, `status` (`pending|paid|expired|failed|refunded`), `midtransTransactionId`, `paymentType`, `rawNotification` (jsonb), `createdAt`, `paidAt`.
- `src/data/external/midtrans.ts` — `createSnapTransaction()` (REST `POST /snap/v1/transactions`, Basic auth server key), `getTransactionStatus()` (`GET /v2/{order_id}/status`), `verifySignature()` = `sha512(order_id + status_code + gross_amount + serverKey)`.
- `POST /api/checkout` — wajib login; jika sudah Pro → 409; buat order `pending`, kembalikan `snap token`.
- Halaman `/harga` — kartu Gratis vs Pro dari `FEATURE_META` (sesuai md), tombol "Upgrade" → load `snap.js` (sandbox/produksi sesuai env) → `window.snap.pay(token)`.
- `POST /api/payments/midtrans/notification` (webhook) — verifikasi signature → **konfirmasi ulang via `getTransactionStatus`** → jika `settlement`/`capture`+`accept` dan `gross_amount === 99000`: dalam satu transaksi DB `orders.status='paid'` + `users.plan='pro'`, `proSince=now()`. **Idempoten** (order yang sudah paid diabaikan). Status `expire/cancel/deny` → update order.
- Setelah popup sukses: halaman `/harga/sukses` polling `/api/me` sampai `plan='pro'` (webhook bisa sedikit terlambat), lalu refresh sesi.
- Env: `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`. Set Notification URL di dashboard Midtrans → `https://<domain>/api/payments/midtrans/notification`.

### Fase 5 — Akun & operasional
- `/akun` — profil, status paket, riwayat pembayaran (dari `orders`), tombol keluar.
- Email konfirmasi Pro via Resend (setelah webhook paid).
- Admin minimal: skrip/route admin (role `admin`) untuk grant/revoke Pro manual (refund, transfer manual, kompensasi).
- Halaman legal: Syarat & Ketentuan (definisi "seumur hidup" = selama layanan beroperasi, kebijakan refund), Kebijakan Privasi; disclaimer edukasi (bukan rekomendasi investasi) yang sudah ada tetap tampil.

### Fase 6 (berikutnya) — Fitur baru dari md yang belum ada
Pasar Global, Peluang Ritel, Ringkasan/Data Pasar sebagai halaman, sidebar navigasi (Pasar / Analisis / Screener Andalan / Sistem), dan screener baru: Uptrend Power, Stochastic GC, Bullish Engulfing, Fair Value Gap, Bull Parade, Early Trend Catcher, ARA Detector, Giant Wave, Asset Play — masing-masing sebagai `ScreenerPreset` baru dengan `tier: 'pro'`, memakai logika yang sudah ada (`earlyBullishReview.ts`, `detectChartChange`, pola candle di `stockAnalysisEngine`).

---

### File penting
- Ubah: `src/app/layout.tsx`, `src/presentation/features/auth/{AuthButton.tsx,useAuthUser.ts}`, `src/presentation/features/terminal/components/TerminalHeader.tsx`, `src/domain/screener/presets.ts`, `src/presentation/features/screener/{ScreenerPage.tsx,components/PresetTabs.tsx,components/BottomNav.tsx}`, `src/presentation/features/analysis/StockAnalysisPage.tsx`, `src/app/api/stocks/[code]/broker-summary/route.ts`, `src/data/repositories/JournalRepository.ts`, `src/app/api/journal/**`.
- Baru: `src/auth.ts`, `proxy.ts`, `drizzle.config.ts`, `src/data/db/{schema,client}.ts`, `src/domain/membership/entitlements.ts`, `src/presentation/features/membership/{useMembership.ts,ProGate.tsx}`, `src/lib/auth/requireFeature.ts`, `src/data/external/midtrans.ts`, `src/app/api/{checkout,payments/midtrans/notification,me}/route.ts`, `src/app/{masuk,harga,harga/sukses,akun}/page.tsx`.
- Sebelum menulis kode: baca `node_modules/next/dist/docs/` untuk `proxy.ts` & route handlers (Next 16), dan docs `next-auth` v5 beta yang terpasang.

### Verifikasi (per fase)
1. **Auth:** `npm run dev` → login Google & magic link email → baris muncul di `users`/`accounts`; `AuthButton` menampilkan avatar; logout bekerja.
2. **Gating:** akun free → preset Pro bergembok, kartu Pro ter-blur, `/backtest` redirect ke `/harga`; `curl` ke `/api/stocks/BBCA/broker-summary` tanpa sesi → 401, akun free → 403.
3. **Pembayaran (Midtrans sandbox):** checkout → bayar via simulator QRIS/VA → webhook masuk (pakai URL preview Vercel atau tunnel) → `orders.status='paid'`, `users.plan='pro'`, UI berubah tanpa login ulang. Kirim ulang webhook yang sama → tidak ada efek ganda. Webhook dengan signature salah → 403.
4. `npx tsc --noEmit` dan `npm run lint` bersih (tanpa error baru); `npm run build` sukses.
5. Deploy preview Vercel dengan env sandbox sebelum mengganti ke kunci produksi Midtrans.

### Keputusan yang masih perlu dikonfirmasi saat implementasi
- Pembagian final Gratis vs Pro di tabel Fase 3 (terutama bagian mana dari v5 & fundamental yang tetap gratis).
- Nama & domain pengirim email (butuh verifikasi domain di Resend).
- Harga promo / kode diskon (tidak termasuk rencana ini).
