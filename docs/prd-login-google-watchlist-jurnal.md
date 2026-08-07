# PRD: Member Login with Google + Watchlist & Jurnal Trading

## 1. Ringkasan

Menambahkan login opsional via Google (Supabase Auth) ke StockPilot AI, sehingga member yang login bisa: (a) menyimpan **Daftar Pantau** (watchlist) yang tersinkron lintas device, dan (b) mencatat **Jurnal Trading** sederhana per transaksi. User yang tidak login tetap bisa memakai Screener & Analisis Saham seperti sekarang (guest mode, watchlist lokal per-device seperti eksisting).

## 2. Latar Belakang / Masalah

- Watchlist saat ini (`useWatchlist.ts`) tersimpan di `localStorage` — hilang kalau clear cache, ganti browser, atau ganti device (HP vs laptop). Tidak ada cara membawa watchlist ke device lain.
- Tidak ada fitur mencatat transaksi trading di aplikasi. User menyimpan jurnal manual di file Excel terpisah (`Jurnal_Trading_Saham_EzySaham.xlsx`), terpisah dari alur analisis saham di aplikasi — padahal idealnya user bisa mencatat langsung dari halaman Analisis Saham.
- Aplikasi belum punya konsep akun sama sekali, jadi personalisasi (watchlist permanen, riwayat jurnal, dan fitur masa depan seperti checklist/backtest di blueprint `docs/stockpilot/`) tidak mungkin dibangun di atasnya.

## 3. Tujuan

- User bisa login dengan 1 klik pakai akun Google, tanpa perlu bikin password baru.
- Watchlist tersimpan permanen per akun dan tersinkron di semua device setelah login.
- User bisa mencatat entri jurnal trading (beli/jual, harga, stop loss, target, hasil, alasan) langsung dari aplikasi.
- Tidak mengganggu pengalaman user yang belum/tidak mau login — Screener & Analisis tetap gratis diakses tanpa akun.

## 4. Non-Goals (di luar scope PRD ini)

- Login dengan email/password atau provider lain (Facebook, Apple, dll) — **hanya Google** di v1.
- Field jurnal lanjutan ala `Jurnal_Trading_Saham_EzySaham.xlsx`: Strategi, Setup Score, Confidence %, Emosi, Alasan Entry/Exit naratif panjang, Evaluasi, ARA?, Selisih TP-High % — didorong ke fase berikutnya (lihat §10).
- Checklist trading, backtest engine, AI watchlist snapshot harian, dashboard IHSG — semua itu bagian dari blueprint besar `docs/stockpilot/` dan **tidak** termasuk PRD ini.
- Migrasi ke Cloudflare Workers/HonoJS — PRD ini tetap di atas Next.js App Router yang sudah ada.
- Fitur admin/moderasi akun, tim/organisasi, sharing watchlist antar user.

## 5. Target User

- Retail trader saham IDX yang sudah pakai StockPilot AI untuk screening & analisis, ingin watchlist-nya permanen dan mulai mencatat jurnal trading dari aplikasi yang sama.

## 6. User Stories

1. Sebagai user baru, saya melihat tombol "Masuk dengan Google" di header — saya klik, redirect ke Google, kembali ke app dalam keadaan login, tanpa perlu isi form apa pun.
2. Sebagai user yang sudah login, saya menandai bintang pada saham di Screener/Analisis — tersimpan ke akun saya, dan saat saya buka app dari HP, watchlist yang sama muncul.
3. Sebagai user yang sebelumnya sudah punya watchlist di localStorage (guest), begitu saya login pertama kali, watchlist lama saya otomatis "diadopsi" ke akun — tidak hilang.
4. Sebagai user yang login, saya membuka halaman "Jurnal", menambah entri baru: kode saham, tanggal beli, harga beli, lot, stop loss, target profit, lalu nanti saya update dengan tanggal jual & harga jual saat posisi ditutup — aplikasi otomatis menghitung profit/loss.
5. Sebagai user yang belum login dan mencoba membuka halaman Jurnal atau menyimpan watchlist, saya diberi prompt untuk login dulu (bukan error tanpa penjelasan).
6. Sebagai user, saya bisa logout kapan saja; setelah logout, app kembali ke guest mode (watchlist lokal device, jurnal tidak bisa diakses).

## 7. Functional Requirements

### 7.1 Auth
- Tombol "Masuk dengan Google" di `AppHeader` (area yang saat ini kosong di kanan, dekat search) — saat belum login.
- Setelah login: tampilkan avatar/inisial + nama singkat, dengan dropdown berisi "Jurnal Saya" dan "Keluar".
- Auth via **Supabase Auth, provider Google (OAuth)** — tidak ada password custom yang dikelola sendiri.
- Session persist antar reload (Supabase client handles refresh token di browser storage).
- Middleware/guard: halaman `/jurnal` dan aksi simpan watchlist-ke-akun memerlukan session aktif; kalau tidak ada session, redirect ke prompt login (bukan 404/500).

### 7.2 Watchlist (upgrade dari fitur existing)
- User **belum login**: perilaku watchlist **tetap seperti sekarang** — localStorage, per-device, tidak berubah (tidak ada regresi untuk guest).
- User **sudah login**: toggle watchlist (bintang) baca/tulis ke tabel Supabase `watchlist`, bukan localStorage. Realtime tidak wajib di v1 — cukup refetch setelah mutasi.
- **Migrasi one-time saat login pertama**: kalau ada data `localStorage['stockpilot:watchlist']`, tickers-nya di-upsert ke tabel `watchlist` milik user (dedup terhadap yang sudah ada di server), lalu localStorage key tsb boleh dibiarkan/dibersihkan setelah sukses sync.
- Batasi jumlah watchlist per user di v1 (misal 50 ticker) untuk mencegah abuse — soft limit, cukup validasi di client + constraint sederhana.

### 7.3 Jurnal Trading (fitur baru, MVP)
Halaman baru `/jurnal` (butuh login). CRUD entri jurnal dengan field MVP:

| Field | Tipe | Wajib? | Catatan |
|---|---|---|---|
| Kode saham (ticker) | text | ya | bisa diisi manual atau dari tombol "Catat ke Jurnal" di halaman Analisis Saham (prefill ticker) |
| Tanggal beli | date | ya | |
| Harga beli | numeric | ya | |
| Lot | integer | ya | 1 lot = 100 lembar (standar IDX) |
| Stop loss | numeric | tidak | |
| Target profit | numeric | tidak | |
| Tanggal jual | date | tidak | diisi belakangan saat posisi ditutup |
| Harga jual | numeric | tidak | |
| Catatan | text (bebas) | tidak | pengganti sementara utk "Alasan Entry/Exit" versi simpel — 1 kolom bebas, bukan 2 kolom terpisah |

- **Profit/Loss Rp** dan **Profit/Loss %** dihitung otomatis (derived, tidak diinput manual) dari harga beli/jual/lot begitu tanggal & harga jual diisi.
- List jurnal diurutkan dari transaksi terbaru; status visual "Posisi terbuka" (belum ada harga jual) vs "Ditutup".
- Ringkasan sederhana di atas list: total transaksi, total profit/loss (Rp), win rate — 3 angka ini konsisten dengan kolom "Ringkasan" di `Jurnal_Trading_Saham_EzySaham.xlsx` milik user, jadi terasa familiar.
- Edit & hapus entri sendiri saja (tidak bisa lihat/edit jurnal user lain).

## 8. Data Model (Supabase Postgres)

Menyelaraskan dengan konvensi yang sudah ditetapkan di `docs/stockpilot/03-database-schema.md` (nama tabel & pola RLS), tapi kolom jurnal dipangkas ke MVP saja:

```
profiles
  id            uuid PK  -- = auth.users.id, dibuat via trigger on signup
  email         text
  display_name  text
  created_at    timestamptz default now()

watchlist
  id         uuid PK default gen_random_uuid()
  user_id    uuid FK -> profiles.id
  ticker     text
  created_at timestamptz default now()
  unique (user_id, ticker)

trading_journal
  id           bigint PK generated always as identity
  user_id      uuid FK -> profiles.id
  ticker       text
  entry_date   date
  entry_price  numeric
  lot          integer
  stop_loss    numeric        -- nullable
  take_profit  numeric        -- nullable
  exit_date    date           -- nullable
  exit_price   numeric        -- nullable
  notes        text           -- nullable
  created_at   timestamptz default now()
  updated_at   timestamptz default now()
```

- RLS aktif di semua tabel: `auth.uid() = user_id` untuk select/insert/update/delete (pola sama seperti di blueprint `docs/stockpilot/`).
- `profit_rp` / `profit_pct` / `is_open` **tidak disimpan** sebagai kolom — dihitung di client (atau lewat generated column Postgres kalau mau query-side) dari `entry_price`, `exit_price`, `lot`.
- Kolom-kolom tambahan dari `Jurnal_Trading_Saham_EzySaham.xlsx` (`strategi`, `setup_score`, `confidence_pct`, `emosi`, `alasan_entry`, `alasan_exit` terpisah, `evaluasi`, `ara`, `max_high`) **belum dibuat** — ditambahkan sebagai kolom nullable di migration terpisah saat fase berikutnya, supaya tidak breaking change.

## 9. Pendekatan Teknis (garis besar, bukan implementasi detail)

- Tambah dependency `@supabase/supabase-js` + `@supabase/ssr` (untuk App Router: server component & route handler client).
- Buat Supabase project, aktifkan provider Google di Supabase Auth (Client ID/Secret dari Google Cloud Console), set redirect URL sesuai domain produksi StockPilot AI.
- `src/lib/supabase/client.ts` (browser client) & `src/lib/supabase/server.ts` (server client, untuk Route Handler/Server Component yang butuh cek session) — pola standar Supabase SSR untuk Next.js App Router.
- `src/app/auth/callback/route.ts` — OAuth callback handler (tukar `code` jadi session, redirect balik ke halaman asal).
- Ganti `useWatchlist.ts` jadi: kalau ada session → baca/tulis Supabase (`WatchlistRepository.ts` baru di `src/data/repositories/`, sejalan dengan pola `StockRepository.ts` yang sudah ada); kalau tidak ada session → tetap localStorage seperti sekarang (tidak menyentuh behavior guest).
- `src/domain/models/JournalEntry.ts` — model baru, dan `src/data/repositories/JournalRepository.ts` — CRUD ke tabel `trading_journal`.
- Halaman baru `src/app/jurnal/page.tsx` + komponen di `src/presentation/features/journal/`.
- `AppHeader.tsx` ditambah slot login/avatar (area kanan header, sebelah timestamp "Update ...").
- Env baru: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (di `.env.local`, tidak dikomit).

## 10. Fase Berikutnya (Out of Scope, dicatat supaya tidak lupa)

- Field jurnal lengkap ala `Jurnal_Trading_Saham_EzySaham.xlsx` (Strategi, Setup Score, Confidence%, Emosi, Alasan Entry/Exit naratif, Evaluasi, ARA?, Max High, Selisih TP-High%).
- Watchlist dengan catatan per ticker (`note` di skema blueprint sudah menyiapkan kolom ini).
- Checklist trading, backtest, AI watchlist snapshot harian — semua bagian blueprint besar `docs/stockpilot/`.
- Provider login tambahan (email/password, Apple, dll) kalau ada permintaan.

## 11. Metrik Keberhasilan

- % user yang klik "Masuk dengan Google" dan berhasil dapat session (funnel drop-off OAuth).
- % watchlist localStorage yang berhasil ter-migrasi ke akun saat login pertama (tidak ada data watchlist hilang).
- Jumlah entri jurnal dibuat per user aktif per minggu (proxy: fitur benar-benar dipakai, bukan cuma dibuat).
- Tidak ada laporan RLS bug (user A bisa lihat data user B).

## 12. Risiko & Pertanyaan Terbuka

- **Setup Google OAuth credentials** (Google Cloud Console project, consent screen, authorized redirect URI) perlu dilakukan manual oleh user/admin sebelum development — bukan sesuatu yang bisa di-otomatisasi dari kode.
- App ini PWA (`next-pwa`) — perlu dipastikan flow OAuth redirect tidak rusak saat dibuka sebagai installed PWA (standalone display mode) di HP.
- Kalau nanti rewrite besar `docs/stockpilot/` betul-betul dikerjakan, tabel `profiles`/`watchlist`/`trading_journal` di atas sudah dirancang kompatibel (subset kolom) — migrasi data lama tinggal tambah kolom, bukan tabel baru.
