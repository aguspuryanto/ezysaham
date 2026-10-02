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

---
Saya sudah cek langsung **Sahamflix**. Menurut saya, yang menarik untuk EzySaham bukan sekadar meniru fitur mereka, tetapi **cara mereka mengemas membership**.

Sahamflix saat ini memakai model **Free Forever → Pro Lifetime Rp99.000**, dengan free user tetap mendapat Ringkasan Pasar, Data Pasar, Global Market, Market Mover, Screener Pro, dan Analisis Broker. Fitur seperti Data Emiten, Bandarmologi, Peluang Ritel, serta sejumlah analitik teknikal dikunci untuk Pro. ([Sahamflix][1])

## 1. Apa yang dilakukan Sahamflix dengan benar

Strukturnya kira-kira:

```text
                 SAHAMFLIX
                     │
          ┌──────────┴──────────┐
          │                     │
       FREE                   PRO
          │                     │
 Market Summary          Data Emiten
 Market Data             Bandarmologi
 Global Market            Peluang Ritel
 Market Movers            Analitik Lanjut
 Screener                 Uptrend Power
 Broker Analysis          Stochastic GC
                          Bullish Engulfing
                          FVG
                          Bull Parade
                          ARA Detector
                          Giant Wave
                          Asset Play
                              │
                         Rp99.000
                         Lifetime
```

Mereka menjual **akses terhadap tools**, bukan menjual "saham yang pasti naik".

Ini bagus karena value proposition-nya sederhana:

> **"Saya bayar supaya proses analisis saham saya menjadi lebih cepat."**

Bukan:

> "Saya bayar supaya dikasih saham yang pasti cuan."

Dan ini menurut saya sangat cocok dengan arah EzySaham yang selama ini kita bangun.

---

# 2. Tapi EzySaham jangan menjadi "Sahamflix versi lain"

Ini yang menurut saya paling penting.

Sahamflix banyak menjual:

**DATA + INDICATOR + SCREENER**

Sedangkan EzySaham sebenarnya punya peluang menjual sesuatu yang lebih tinggi levelnya:

**DATA → ANALYSIS → DECISION**

Contohnya:

### Sahamflix

```text
BBRI
Price     3.140
RSI       43
MACD      Bearish
Volume    1.8x
```

User masih harus berpikir:

> "Terus saya beli atau nggak?"

### EzySaham

```text
BBRI
━━━━━━━━━━━━━━━━━━━━

MARKET STATE
Bearish

SETUP
Momentum Recovery

TREND
❌ Below EMA200

MOMENTUM
⚠️ Weak

VOLUME
✅ Above Average

SMART MONEY
⚠️ Neutral

RISK
🔴 High

ACTION
WAIT

WHY?
Harga masih berada di bawah EMA200
dan belum mendapatkan konfirmasi
momentum + volume.

BUY ONLY IF
Harga reclaim 3.200
+ volume meningkat
+ bullish candle confirmation.
```

**Ini jauh lebih bernilai bagi user pemula.**

Karena user tidak membeli data.

User membeli **pengurangan kebingungan**.

---

# 3. Membership EzySaham sebaiknya jangan hanya "Premium"

Saya justru menyarankan 3 level.

## EzySaham FREE

Tujuannya:

> **Bikin orang merasakan EzySaham.**

Contoh:

### FREE

* Market Overview
* Top Gainer
* Top Loser
* Basic Screener
* 5 saham Watchlist
* Basic Fundamental
* Basic Technical
* 3 Signal / hari
* Basic Stock Profile
* Basic EzyScore

Misalnya:

```text
BBRI

EzyScore
72 / 100

Trend       🟢
Momentum    🟡
Volume      🟢
Fundamental 🟢
Smart Money 🟡

Status
WATCH
```

Ini sudah cukup berguna.

---

# 4. EzySaham PRO

Ini yang menjadi **produk utama**.

Saya akan membuatnya sekitar:

### Rp49.000 / bulan

### Rp149.000 / 6 bulan

### Rp249.000 / tahun

Dan mungkin:

### Rp499.000 Lifetime

Tidak harus langsung semua tersedia. Bisa dimulai dari monthly + yearly.

---

# 5. Apa yang dikunci di PRO?

Bukan sekadar "lebih banyak indikator".

Justru kunci fitur **decision engine**.

### PRO mendapatkan:

#### ① EzySignal

```text
🔥 EzySignal

Ticker: XYZ

SETUP
Momentum Breakout

CONFIDENCE
78%

ENTRY
1.020 – 1.040

TP1
1.100

TP2
1.160

SL
980

R:R
1 : 2.4

STATUS
🟢 BUY ALLOWED
```

---

#### ② Why Buy?

Ini menurut saya harus menjadi fitur signature EzySaham.

```text
WHY BUY?

1. Price > EMA200
2. EMA8 > EMA18
3. Momentum candle muncul
4. Volume 2.4× average
5. Breakout resistance
6. Smart money accumulation

CONCLUSION

Setup memiliki momentum + volume
yang mendukung breakout.
```

---

#### ③ Risk Gate

Ini bahkan lebih penting daripada BUY.

```text
RISK GATE

Trend          🟢
Momentum       🟢
Volume         🟢
Liquidity      🟢
Overextension  🟡
Market Risk    🟡

TOTAL
🟢 ACCEPTABLE
```

Atau:

```text
🔴 TRADE BLOCKED

Reason:

Price is below EMA200
Momentum is weakening
Volume confirmation absent

Do not chase.
```

Ini sangat cocok dengan filosofi EzySaham yang selama ini kita bangun: **jangan memaksa BUY ketika edge tidak ada.**

---

# 6. Buat "EzySaham Signal" menjadi produk utama

Saya malah akan memisahkan:

### Screener

menjawab:

> **"Saham apa yang menarik?"**

### Signal

menjawab:

> **"Apakah sekarang boleh entry?"**

### Stock Analysis

menjawab:

> **"Kenapa?"**

### Trading Plan

menjawab:

> **"Kalau entry, bagaimana mengelola risikonya?"**

Sehingga:

```text
SCREENER
    ↓
Candidate
    ↓
SIGNAL ENGINE
    ↓
Why Buy?
    ↓
Risk Gate
    ↓
Trading Plan
    ↓
Entry / TP / SL
```

Ini jauh lebih jelas daripada menumpuk 20 indikator.

---

# 7. Saya akan membuat 4 "Engine" dalam membership EzySaham

Ini menurut saya bisa menjadi pembeda utama.

## ENGINE 1 — Intraday

```text
Ezy Intraday

VWAP
Volume
RVOL
Momentum
Market Structure
Bid/Offer
Breakout
Rejection
```

Output:

```text
BUY
WAIT
NO TRADE
```

---

## ENGINE 2 — Swing

Ini yang sudah banyak kita diskusikan.

```text
EMA8
EMA18
EMA200
RSI
MACD
Volume
Structure
Momentum Candle
Breakout
Pullback
```

Output:

```text
SWING SETUP

Entry
TP
SL
R:R
Risk Gate
```

---

## ENGINE 3 — Smart Money

Bukan sekadar "bandarmologi".

Gabungkan:

```text
Broker Flow
Foreign Flow
Accumulation
Distribution
Volume
Price Structure
Big Transaction
```

Output:

```text
SMART MONEY

Accumulation
   ↓
Early Momentum
   ↓
Breakout
   ↓
Distribution
```

Ini bisa menjadi fitur premium yang menarik.

---

## ENGINE 4 — Fundamental

```text
Revenue Growth
Profit Growth
ROE
DER
FCF
PER
PBV
Dividend
Debt
```

Output jangan hanya:

> ROE 21%

Tetapi:

```text
FUNDAMENTAL QUALITY

Profit Growth       🟢
ROE                 🟢
Debt                🟢
Cash Flow           🟢
Valuation           🟡

QUALITY
82/100
```

---

# 8. Ada satu fitur yang menurut saya Sahamflix belum "memaksimalkan"

## EzySaham "10 Second Review"

Ini bisa menjadi **signature feature**.

User buka saham:

```text
BBRI
━━━━━━━━━━━━━━━━━━

10 SECOND REVIEW

TREND       🟢
MOMENTUM    🟡
VOLUME      🟢
SMART MONEY 🟢
FUNDAMENTAL 🟢
VALUATION   🟡

━━━━━━━━━━━━━━━━━━

SIGNAL

🟡 WAIT

WHY?

Trend masih bullish,
tetapi momentum belum cukup
untuk entry agresif.

BUY IF

> 3.200
+ volume confirmation

RISK

Below 3.120
```

User bisa memahami saham **dalam 10 detik**.

Itu jauh lebih mudah dijual daripada:

> "Kami memiliki 35 indikator teknikal."

---

# 9. Buat juga "EzySaham AI"

Nah, ini bisa menjadi pembeda terbesar.

Misalnya user bertanya:

> "Kenapa BBRI turun hari ini?"

AI menjawab berdasarkan data EzySaham:

```text
BBRI turun 2.1%.

3 penyebab utama:

1. Harga breakdown VWAP
2. Volume selling meningkat 2.4×
3. Foreign flow negatif

Namun struktur medium-term
belum rusak karena harga masih
di atas EMA200.

Kesimpulan:

SHORT-TERM
🔴 Bearish

SWING
🟡 Caution

LONG-TERM
🟢 Structure intact
```

Bukan AI generik.

**AI yang membaca database EzySaham.**

---

# 10. Membership page EzySaham

Saya justru tidak akan membuat halaman membership seperti SaaS biasa.

Hero:

# EzySaham Pro

### Berhenti menebak saham.

### Mulai membaca peluang dengan sistem.

Kemudian:

```text
FREE                         PRO

Market Overview              Everything FREE
Basic Screener               Advanced Screener
Basic Technical              EzySignal
Basic Fundamental            Why Buy
                             Risk Gate
                             TP / SL
                             Smart Money
                             Swing Engine
                             Intraday Engine
                             AI Analysis
                             Unlimited Watchlist
```

---

# 11. Pricing yang saya sarankan

Saya tidak akan langsung meniru Rp99.000 lifetime Sahamflix.

Karena ada masalah:

**Lifetime = liability.**

Kalau EzySaham terus berkembang dan biaya:

* database
* API market data
* AI
* server
* storage
* maintenance

meningkat, user lifetime tetap membayar Rp0.

Untuk produk EzySaham yang ingin serius, recurring revenue lebih sehat.

Saya akan mulai:

| Paket            |      Harga |
| ---------------- | ---------: |
| Free             |        Rp0 |
| Pro Monthly      |  **Rp49K** |
| Pro 6 Month      | **Rp199K** |
| Pro Yearly       | **Rp299K** |
| Founder Lifetime | **Rp499K** |

Founder Lifetime bisa dibatasi:

> **500 member pertama**

Setelah itu hilangkan.

---

# 12. Bahkan bisa dibuat "EzySaham Trader"

Ini menurut saya lebih menarik daripada satu membership besar.

### EzySaham Free

untuk semua orang.

### EzySaham Pro

untuk investor/trader.

### EzySaham Trader

untuk user aktif:

```text
Intraday Engine
Swing Engine
Real-time Signal
Smart Money
Advanced Scanner
AI Copilot
Trading Journal
Backtest
Alerts
```

Jadi nantinya:

```text
FREE
  ↓
PRO
  ↓
TRADER
```

---

# 13. Positioning EzySaham

Kalau Sahamflix:

> **IDX Data Platform**

EzySaham menurut saya lebih tepat:

> ## **AI-Powered Stock Decision Platform**

atau versi Indonesia:

> ## **Platform Analisis & Keputusan Trading Saham Indonesia**

Karena EzySaham bukan hanya mengumpulkan data.

Target akhirnya:

```text
DATA
 ↓
PATTERN
 ↓
SIGNAL
 ↓
REASON
 ↓
RISK
 ↓
ACTION
```

**Itulah produk yang sebenarnya Anda jual.**

---

# 14. Arsitektur membership EzySaham

Saya akan merancang seperti ini:

```text
                    EZYSAHAM
                       │
          ┌────────────┴────────────┐
          │                         │
        FREE                       PRO
          │                         │
     Market Data               EzySignal
     Market Movers             Why Buy
     Basic Screener            Risk Gate
     Basic Analysis            TP / SL
                               Smart Money
                               Swing Engine
                               Intraday Engine
                               AI Analysis
                                    │
                                    ↓
                              TRADER PRO
                                    │
                              Real-time
                              Alerts
                              Backtest
                              Journal
                              Advanced AI
```

Dan **jangan menjual "sinyal BUY" sebagai inti produk**.

Jual:

> **"Sistem yang membantu Anda memahami kapan sebuah saham memiliki setup, alasan, target, dan risiko yang jelas."**

Itu jauh lebih sustainable dan cocok dengan arah EzySaham yang sudah kita kembangkan.

Sebagai benchmark, model membership saham di Indonesia memang sangat bervariasi: Sahamflix menggunakan **free forever + lifetime Rp99 ribu**, sedangkan Kaji menggunakan **Rp50 ribu/bulan, Rp199 ribu/6 bulan, Rp299 ribu/12 bulan** dan menekankan riset/edukasi, bukan nasihat investasi. ([Sahamflix][2])

**Kalau saya yang mengembangkan EzySaham sekarang, saya akan memprioritaskan MVP membership hanya 5 fitur:** **EzySignal + Why Buy + Risk Gate + Trading Plan (TP/SL) + AI Stock Analysis.** Jangan dulu membuat 30 fitur. Kelima fitur itu sudah cukup untuk membuat user merasa, *"oh, EzySaham membantu saya mengambil keputusan, bukan cuma menampilkan angka."*

[1]: https://sahamflix.com/ "Sahamflix — Analisis Saham Indonesia"
[2]: https://sahamflix.com/?p=1050&utm_source=chatgpt.com "Sahamflix — Analisis Saham Indonesia"

----
Anda adalah Senior Product Engineer + UI/UX Designer yang bertugas membangun MVP Membership EzySaham.

CONTEXT
EzySaham adalah platform analisis saham Indonesia berbasis data market, technical analysis, fundamental analysis, smart money, dan AI.

Tujuan MVP:
Membuat membership berbayar yang memberikan user kemampuan mengubah DATA saham menjadi KEPUTUSAN trading yang jelas.

JANGAN membangun terlalu banyak fitur.
Fokus hanya pada 5 fitur inti:

1. EzySignal
2. Why Buy
3. Risk Gate
4. Trading Plan (Entry / TP / SL)
5. AI Stock Analysis


==================================================
1. PRODUCT POSITIONING
==================================================

EzySaham bukan sekadar screener saham.

Core value:

DATA
→ PATTERN
→ SIGNAL
→ REASON
→ RISK
→ TRADING PLAN
→ ACTION

User harus bisa membuka satu saham dan dalam ±10 detik memahami:

- Apa yang sedang terjadi?
- Apakah ada setup?
- Kenapa saham ini menarik?
- Apa risikonya?
- Di harga berapa entry?
- Di mana TP?
- Di mana SL?
- Apa kesimpulan AI?


==================================================
2. MEMBERSHIP MODEL
==================================================

Buat 2 role:

FREE
PRO

FREE:
- Basic market overview
- Basic stock search
- Basic stock profile
- Basic technical data
- Basic fundamental data
- Limited AI analysis
- Tidak mendapatkan full EzySignal

PRO:
- Full EzySignal
- Why Buy
- Risk Gate
- Trading Plan
- AI Stock Analysis
- Unlimited stock analysis
- Full signal history

Buat sistem feature gating.

Jika user FREE membuka fitur PRO:

Tampilkan preview fitur + CTA:

"Unlock EzySaham Pro"

Jangan langsung menampilkan seluruh hasil premium.


==================================================
3. EzySIGNAL
==================================================

Buat engine yang menghasilkan status:

BUY
WAIT
NO TRADE

Signal bukan sekadar berdasarkan satu indikator.

Gunakan kombinasi:

TECHNICAL:
- Price
- EMA 8
- EMA 18
- EMA 200
- RSI
- MACD
- Volume
- Relative Volume
- VWAP jika data tersedia
- Support
- Resistance
- Market structure

MOMENTUM:
- Bullish candle
- Bearish candle
- Breakout
- Pullback
- Rejection
- Volume confirmation

TREND:
- Price > EMA200
- EMA8 > EMA18
- EMA18 > EMA200

RISK:
- Overextended
- Below EMA200
- Weak volume
- Failed breakout
- Poor risk/reward

Signal engine harus menggunakan weighted scoring.

Contoh:

Trend              25%
Momentum           25%
Volume             20%
Structure          15%
Risk               15%

Hasil:

80-100 = BUY ALLOWED
60-79  = WAIT / WATCH
<60    = NO TRADE

PENTING:
Score bukan rekomendasi investasi.
Gunakan score sebagai internal decision-support engine.

Jangan menghasilkan BUY hanya karena RSI rendah atau satu indikator bullish.


==================================================
4. WHY BUY
==================================================

Buat fitur yang menjelaskan:

"KENAPA SAHAM INI MENARIK?"

Contoh output:

WHY BUY?

✓ Price above EMA200
✓ EMA8 above EMA18
✓ Bullish momentum candle
✓ Volume 2.1× average
✓ Breakout resistance
✓ RSI 58 — healthy momentum

CONCLUSION:

"Setup menunjukkan kombinasi trend,
momentum dan volume yang mendukung
potensi continuation."

Jika tidak ada alasan kuat:

WHY BUY?

⚠️ Tidak terdapat cukup konfirmasi.

Missing confirmation:
- Volume
- Breakout confirmation
- Momentum

Jangan memaksakan alasan BUY.


==================================================
5. RISK GATE
==================================================

Risk Gate adalah fitur penting.

Tujuannya menjawab:

"APA YANG BISA SALAH?"

Evaluasi:

- Trend risk
- Momentum risk
- Volume risk
- Liquidity risk
- Overextension risk
- Market risk
- Support proximity
- Stop-loss distance
- Risk/reward

Output:

GREEN
YELLOW
RED

Contoh:

RISK GATE

Trend          GREEN
Momentum       GREEN
Volume         GREEN
Liquidity      GREEN
Overextension  YELLOW
Market Risk    YELLOW

Overall Risk:
YELLOW

Reason:
Harga sudah naik 8% dari breakout
sehingga entry sekarang berisiko mengejar harga.


Jika:

Price < EMA200
AND
EMA8 < EMA18
AND
weak volume

maka:

RED

TRADE BLOCKED

Reason:
Trend dan momentum belum mendukung.


==================================================
6. TRADING PLAN
==================================================

Buat Trading Plan otomatis berdasarkan struktur harga.

Output:

TRADING PLAN

Entry Zone:
1.020 - 1.040

TP1:
1.100

TP2:
1.160

Stop Loss:
980

Risk:
5.8%

Potential:
TP1 +6.7%
TP2 +11.5%

Risk / Reward:
1 : 1.8
1 : 3.1

Entry Type:

BUY ON BREAKOUT
atau
BUY ON PULLBACK

Jangan membuat TP/SL secara random.

Gunakan:

- Support
- Resistance
- ATR jika tersedia
- Swing low
- Breakout level
- Current price
- Risk/reward

Minimum target R:R configurable.

Default:
Minimum R:R = 1:2

Jika R:R buruk:

TRADING PLAN
⚠️ INVALID

Reason:
Potential reward tidak cukup dibandingkan
risk.


==================================================
7. AI STOCK ANALYSIS
==================================================

Buat halaman:

/stock/[ticker]/ai

AI tidak boleh mengarang data.

AI hanya boleh menggunakan structured market data yang diberikan backend.

Input AI:

ticker
company_name
price
change
volume
relative_volume
EMA8
EMA18
EMA200
RSI
MACD
VWAP
support
resistance
trend
momentum
smart_money
fundamental
signal
risk_gate
trading_plan

Output:

1. Market Context
2. Technical Analysis
3. Momentum
4. Volume
5. Smart Money
6. Fundamental
7. Risk
8. Trading Plan
9. Final Summary

Contoh:

AI STOCK ANALYSIS

BBRI

Market Context:
Harga sedang berada dalam fase recovery,
namun belum memberikan konfirmasi breakout.

Technical:
Price masih berada di bawah resistance.

Momentum:
RSI mulai membaik tetapi belum menunjukkan
momentum ekstrem.

Volume:
Volume belum cukup kuat untuk mengonfirmasi breakout.

Risk:
Entry agresif memiliki risiko false breakout.

Summary:
"Setup belum lengkap. Tunggu konfirmasi breakout
disertai peningkatan volume."


==================================================
8. STOCK DETAIL PAGE
==================================================

Buat halaman utama:

/stock/[ticker]

Layout:

HEADER

BBRI
Bank Rakyat Indonesia

Rp3.140
-1.00%

[ EzySignal ]

WAIT

--------------------------------

WHY BUY?

[reason cards]

--------------------------------

RISK GATE

[YELLOW]

--------------------------------

TRADING PLAN

Entry
TP1
TP2
SL
R:R

--------------------------------

AI STOCK ANALYSIS

[AI summary]

[View Full Analysis]

--------------------------------

TECHNICAL DATA

EMA
RSI
MACD
Volume
VWAP

--------------------------------

FUNDAMENTAL

ROE
PER
PBV
Revenue Growth
Profit Growth


==================================================
9. EzySIGNAL CARD
==================================================

Buat komponen reusable:

<EzySignalCard />

Props:

ticker
signal
confidence
trend
momentum
volume
risk
entry
tp1
tp2
sl

Contoh UI:

┌─────────────────────────────┐
│ BBRI                       │
│                             │
│ 🟡 WAIT                     │
│                             │
│ Setup: Momentum Recovery    │
│ Confidence: 68%             │
│                             │
│ Trend       🟢              │
│ Momentum    🟡              │
│ Volume      🟢              │
│ Risk        🟡              │
│                             │
│ BUY IF                      │
│ > 3.200 + volume confirm    │
└─────────────────────────────┘


==================================================
10. DASHBOARD PRO
==================================================

Buat:

/dashboard

Sections:

Today's Signals

BUY
WAIT
NO TRADE

Top Opportunities

Risk Alerts

Recent AI Analysis

Watchlist

Signal History

Contoh:

TODAY'S SIGNALS

BUY ALLOWED
5 stocks

WAIT
12 stocks

NO TRADE
31 stocks


==================================================
11. SIGNAL HISTORY
==================================================

Simpan setiap signal.

Database:

signals

id
ticker
signal
confidence
price
entry
tp1
tp2
sl
risk_reward
trend
momentum
volume_score
risk_score
created_at

User dapat melihat:

Signal
Price
Entry
TP
SL
Status
Created At

Jangan klaim performa / win rate sebelum ada data historis
yang benar-benar dihitung.


==================================================
12. DATABASE
==================================================

Buat schema membership:

users
subscriptions
plans
features
user_features

plans:

FREE
PRO

subscriptions:

id
user_id
plan_id
status
started_at
expired_at
created_at

features:

id
key
name
description

Contoh feature key:

EZY_SIGNAL
WHY_BUY
RISK_GATE
TRADING_PLAN
AI_ANALYSIS


==================================================
13. FEATURE GATING
==================================================

Buat reusable:

<PremiumGate />

Contoh:

<PremiumGate feature="WHY_BUY">

Jika PRO:
render content

Jika FREE:
render blurred preview:

WHY BUY

✓ Price > EMA200
✓ Volume confirmation
✓ Momentum improving

[ 🔒 Unlock EzySaham Pro ]


==================================================
14. PRICING PAGE
==================================================

Buat:

/pricing

FREE

Rp0

Basic Market
Basic Screener
Basic Stock Data


PRO

Rp49.000 / month

✓ EzySignal
✓ Why Buy
✓ Risk Gate
✓ Trading Plan
✓ AI Stock Analysis
✓ Unlimited Analysis
✓ Signal History

CTA:

"Upgrade to Pro"


==================================================
15. UI / UX
==================================================

Style:

Modern fintech dashboard.

Gunakan:

- clean
- minimal
- professional
- mobile responsive
- dark/light mode
- card based layout
- strong information hierarchy

Jangan membuat UI terlalu ramai.

Prioritaskan:

SIGNAL
REASON
RISK
PLAN

Gunakan visual hierarchy:

BUY = positive
WAIT = neutral
NO TRADE = negative

Tetapi jangan menggunakan warna sebagai satu-satunya informasi.


==================================================
16. TECHNICAL ARCHITECTURE
==================================================

Gunakan architecture yang mudah dikembangkan.

Frontend:
Next.js
TypeScript
Tailwind CSS

Backend:
gunakan API/backend yang sudah tersedia di project.

Database:
gunakan database existing EzySaham.

Jangan membuat database baru jika schema existing
sudah menyediakan data yang diperlukan.

Pisahkan:

/components
/features
/lib
/services
/types
/app

Engine:

/lib/analysis/ezySignal
/lib/analysis/whyBuy
/lib/analysis/riskGate
/lib/analysis/tradingPlan
/lib/ai/stockAnalysis


==================================================
17. API
==================================================

Buat endpoint:

GET /api/stock/[ticker]

GET /api/stock/[ticker]/signal

GET /api/stock/[ticker]/why-buy

GET /api/stock/[ticker]/risk

GET /api/stock/[ticker]/trading-plan

POST /api/stock/[ticker]/ai-analysis

GET /api/signals

GET /api/subscription

GET /api/features


==================================================
18. IMPORTANT RULES
==================================================

1. Jangan mengarang market data.

2. Jangan mengarang technical indicator.

3. Jika data tidak tersedia:
   tampilkan "Data unavailable".

4. Jangan menghasilkan signal hanya berdasarkan satu indikator.

5. BUY harus membutuhkan confirmation.

6. Jika risk terlalu tinggi:
   signal harus turun menjadi WAIT atau NO TRADE.

7. Jangan menggunakan istilah:
   "pasti naik"
   "pasti cuan"
   "100% profit"
   "jaminan profit"

8. AI harus menjelaskan uncertainty.

9. Semua signal harus memiliki:
   Reason
   Risk
   Entry
   TP
   SL

10. Jangan membuat fitur di luar scope MVP.


==================================================
19. MVP ACCEPTANCE CRITERIA
==================================================

MVP dianggap selesai jika:

[ ] User dapat login
[ ] User memiliki FREE / PRO status
[ ] Feature gating bekerja
[ ] User dapat mencari ticker
[ ] Stock detail page tersedia
[ ] EzySignal bekerja
[ ] Why Buy bekerja
[ ] Risk Gate bekerja
[ ] Trading Plan menghasilkan Entry/TP/SL
[ ] AI Stock Analysis bekerja
[ ] Signal tersimpan ke database
[ ] Signal history tersedia
[ ] Pricing page tersedia
[ ] Upgrade CTA tersedia
[ ] Mobile responsive
[ ] Loading state
[ ] Empty state
[ ] Error state
[ ] Tidak ada fake market data
[ ] Tidak ada fake performance claim

==================================================
20. DEVELOPMENT APPROACH
==================================================

Jangan langsung membuat seluruh aplikasi.

Kerjakan bertahap:

PHASE 1
Audit existing EzySaham codebase.

Identifikasi:
- existing authentication
- existing database
- stock data API
- technical indicators
- existing screener
- existing stock detail page
- existing components

Jangan membuat ulang sesuatu yang sudah tersedia.

PHASE 2
Implement membership + feature gating.

PHASE 3
Implement EzySignal engine.

PHASE 4
Implement:
Why Buy
Risk Gate
Trading Plan

PHASE 5
Implement AI Stock Analysis.

PHASE 6
Build PRO dashboard + signal history.

PHASE 7
Testing.

Sebelum coding, tampilkan:

1. Existing architecture
2. Files yang akan diubah
3. Files yang akan dibuat
4. Database changes
5. API changes
6. Implementation plan

Setelah itu implementasikan MVP secara bertahap.

PRIORITAS UTAMA:

Jangan membuat EzySaham menjadi aplikasi yang memiliki
banyak indikator.

Buat EzySaham menjadi aplikasi yang membantu user
menjawab 5 pertanyaan:

1. ADA SETUP?
2. KENAPA MENARIK?
3. APA RISIKONYA?
4. ENTRY DI MANA?
5. TP DAN SL DI MANA?

Core product:

EzySignal
+
Why Buy
+
Risk Gate
+
Trading Plan
+
AI Stock Analysis