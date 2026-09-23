# Fitur: Portofolio Saham

## 1. Ringkasan

Member yang login (Google via Supabase Auth) bisa mencatat **saham yang sedang dipegang**: kode saham, jumlah lot, lot tersedia, dan harga rata-rata. Kolomnya sama seperti tampilan portofolio di aplikasi sekuritas:

| Symbol | Balance Lot | Available Lot | Average Price |
|---|---:|---:|---:|
| BBRI | 35 | 35 | 3.334,91 |
| BRPT | 65 | 35 | 1.831,06 |
| BUVA | 0,97 | 0,97 | 878,31 |

EzySaham lalu menghitung otomatis **nilai pasar**, **floating profit/loss**, dan **bobot tiap saham** dari harga terakhir. Setiap holding juga dihubungkan ke analisis EzySaham yang sudah ada (status 10-Second Review), supaya user langsung tahu kondisi saham yang sedang dipegang.

Data disimpan di **Supabase Postgres**, satu baris per saham per user, dan dilindungi Row Level Security (RLS). Data tersinkron antar device dan tidak bisa dilihat user lain.

## 2. Latar Belakang

- Selama ini user memantau portofolio di aplikasi sekuritas, lalu pindah ke EzySaham untuk menganalisis tiap saham satu per satu. Tidak ada satu tempat yang menjawab "saham yang saya pegang sekarang kondisinya bagaimana?"
- Jurnal Trading (`/jurnal`) mencatat **sinyal/entry**, bukan **posisi yang sedang dipegang**. Jurnal juga disimpan di Vercel Blob sebagai satu file JSON, jadi praktis hanya untuk satu user. Portofolio harus per akun, jadi memakai tabel Supabase.
- Login Google via Supabase sudah tersedia (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/presentation/features/auth/useAuthUser.ts`, `src/proxy.ts`, `src/app/auth/callback/route.ts`), tetapi belum ada tabel data yang dipakai. Portofolio akan jadi tabel pertama.

## 3. Tujuan

- User bisa menambah, mengubah, dan menghapus holding secara manual lewat form.
- User langsung melihat total modal, total nilai pasar, total floating P/L (Rp dan %), dan jumlah emiten.
- User langsung melihat status analisis tiap holding (BUY SETUP / WAIT / WATCHLIST / NO TRADE) dan peringatan penting, misalnya harga di bawah support atau setup batal.
- Data aman per akun (RLS) dan tersinkron antar device.

## 4. Non-Goals (di luar v1)

- Koneksi otomatis ke API sekuritas (Stockbit, Ajaib, IPOT, dan lain-lain). Semua input dilakukan manual.
- Riwayat transaksi beli/jual dan realized P/L.
- Import CSV/paste dari sekuritas.
- Dividen, right issue, stock split, dan corporate action lain.
- Rekomendasi jual/beli otomatis. Status analisis hanya **informasi**, bukan perintah.
- Mode guest (localStorage). Portofolio v1 hanya untuk user yang login.

## 5. User Stories

1. Sebagai user yang login, saya membuka `/portofolio`, klik **Tambah Saham**, lalu mengisi `BBRI`, `35` lot, dan average `3334.91`. Holding langsung muncul di tabel dengan nilai pasar dan P/L-nya.
2. Sebagai user yang baru saja average down, saya **mengedit** lot dan average price BBRI tanpa perlu menghapus dan membuat ulang.
3. Sebagai user yang sudah menjual habis sebuah saham, saya **menghapus** holding tersebut.
4. Sebagai user, saya melihat ringkasan di atas tabel: total modal, total nilai, total P/L, dan jumlah emiten.
5. Sebagai user, saya melihat kolom **Status** per holding dan bisa klik ticker untuk membuka halaman analisis lengkap (`/screener/[ticker]`).
6. Sebagai user di halaman analisis saham, saya klik **Tambah ke Portofolio** dan form terbuka dengan ticker sudah terisi.
7. Sebagai user yang belum login, saat membuka `/portofolio` saya melihat ajakan **Masuk dengan Google**, bukan error.

## 6. Functional Requirements

### 6.1 Field Input (form tambah/edit)

| Field | Tipe | Wajib | Aturan |
|---|---|---|---|
| `ticker` | text | ya | Otomatis uppercase. Harus ada di daftar saham dari `getStockSummaries()`. Unik per user. |
| `balance_lot` | numeric(12,2) | ya | > 0. **Boleh desimal** untuk odd lot, misalnya `0.97` = 97 lembar (lihat BUVA/RISE di screenshot). |
| `available_lot` | numeric(12,2) | tidak | Default = `balance_lot`. Harus 0 ≤ nilai ≤ `balance_lot`. Menggambarkan lot yang tidak sedang di-order jual (BRPT: 65 balance, 35 available). |
| `average_price` | numeric(14,2) | ya | > 0. Harga rata-rata **per lembar**, sama seperti yang tampil di sekuritas. |
| `notes` | text | tidak | Alasan beli atau rencana, maksimal 500 karakter. |

Kalau user menambah ticker yang sudah ada di portofolionya, form **menolak** dan menawarkan "Edit holding yang sudah ada". Holding tidak dijumlahkan diam-diam, karena menggabungkan average price perlu keputusan user.

### 6.2 Nilai Turunan (dihitung di client, tidak disimpan)

Harga terakhir (`lastClose`) diambil dari `getStockSummaries()` (`src/data/repositories/StockRepository.ts`), sumber yang sama dengan Screener.

| Nilai | Rumus |
|---|---|
| Lembar | `balance_lot × 100` |
| Modal | `lembar × average_price` |
| Nilai pasar | `lembar × lastClose` |
| Floating P/L (Rp) | `nilai pasar − modal` |
| Floating P/L (%) | `(lastClose − average_price) / average_price × 100` |
| Bobot | `nilai pasar holding / total nilai pasar × 100` |

**Ringkasan atas tabel:** total modal, total nilai pasar, total floating P/L (Rp dan %), dan jumlah emiten.

Contoh: BBRI dengan 35 lot × 100 × Rp3.334,91 menghasilkan modal **Rp11.672.185**. Kalau `lastClose` = Rp3.500, nilai pasarnya Rp12.250.000 dan floating P/L-nya **+Rp577.815 (+4,95%)**.

Aturan tampilan:
- Harga tidak tersedia (saham suspend atau data belum ter-load): nilai pasar dan P/L tampil sebagai `–` dan **tidak dihitung ke total**. Tambahkan catatan "n saham belum punya harga".
- Warna P/L: hijau jika positif, merah jika negatif. Tidak memakai kata "untung pasti" atau "rugi".
- Disclaimer kecil di bawah tabel: *"Harga memakai data penutupan/kuotasi tertunda, belum termasuk fee broker & pajak. Angka bisa berbeda dengan aplikasi sekuritas."*

### 6.3 Integrasi Analisis EzySaham

- Kolom **Status** per holding memakai logika yang sama dengan kartu 10-Second Review (`buildTenSecondReview` di `src/domain/analysis/tenSecondReview.ts`). Untuk banyak ticker sekaligus, pakai jalur bulk seperti `src/domain/analysis/screenerVerdict.ts` agar tidak perlu membuka halaman analisis satu per satu.
- Peringatan khusus untuk pemegang saham (informasi, bukan perintah jual):
  - Harga **di bawah support terdekat** → "Harga menembus support — cek ulang rencana".
  - Harga di bawah EMA200 → "Tren jangka panjang melemah".
  - Floating loss melewati ambang tertentu (default −7%, sesuai `DEFAULT_SL_PCT` di `src/domain/analysis/tradeValidation.ts`) → "Floating loss melewati batas risiko umum".
- Status dimuat secara **lazy** (setelah tabel tampil), supaya halaman tetap cepat walaupun portofolio berisi banyak saham.

### 6.4 Halaman & Navigasi

- Route baru: `/portofolio` (`src/app/portofolio/page.tsx`).
- Desktop: tabel dengan kolom Symbol (avatar + ticker), Balance Lot, Available Lot, Average Price, Harga, Nilai Pasar, P/L (Rp dan %), Bobot, Status, dan Aksi (edit/hapus). Gaya neo-border sama dengan `src/presentation/features/screener/components/ResultsTableNew.tsx`.
- Mobile: kartu per holding.
- Urutan default: nilai pasar terbesar di atas. Kolom lain bisa di-sort.
- Link **Portofolio** di `src/presentation/components/layout/AppHeader.tsx`, di sebelah link `/jurnal`.
- Tombol **Tambah ke Portofolio** di halaman analisis saham (prefill ticker). Jika ticker sudah ada di portofolio, tombol berubah menjadi **Edit di Portofolio**.

## 7. Data Model (Supabase Postgres)

Konvensi nama dan pola RLS mengikuti `docs/stockpilot/03-database-schema.md` dan `docs/prd-login-google-watchlist-jurnal.md`.

```sql
create table public.portfolio_holdings (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  ticker         text not null check (ticker = upper(ticker) and length(ticker) between 2 and 8),
  balance_lot    numeric(12,2) not null check (balance_lot > 0),
  available_lot  numeric(12,2) check (available_lot >= 0 and available_lot <= balance_lot),
  average_price  numeric(14,2) not null check (average_price > 0),
  notes          text check (notes is null or length(notes) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, ticker)
);

create index portfolio_holdings_user_idx on public.portfolio_holdings (user_id);

-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger portfolio_holdings_updated_at
before update on public.portfolio_holdings
for each row execute function public.set_updated_at();

-- Row Level Security: user hanya bisa akses baris miliknya
alter table public.portfolio_holdings enable row level security;

create policy "portfolio_select_own" on public.portfolio_holdings
  for select using (auth.uid() = user_id);
create policy "portfolio_insert_own" on public.portfolio_holdings
  for insert with check (auth.uid() = user_id);
create policy "portfolio_update_own" on public.portfolio_holdings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "portfolio_delete_own" on public.portfolio_holdings
  for delete using (auth.uid() = user_id);
```

Catatan:
- `user_id` merujuk ke `auth.users` langsung, karena tabel `profiles` belum ada. Jika nanti `profiles` dibuat, FK bisa diarahkan ke `profiles.id` (nilainya sama).
- Nilai turunan (modal, nilai pasar, P/L) **tidak disimpan**, karena harga berubah setiap hari.
- Simpan migration sebagai file SQL di repo (misalnya `supabase/migrations/<timestamp>_portfolio_holdings.sql`) supaya bisa diulang di environment lain.

## 8. Arsitektur Teknis

Mengikuti lapisan yang sudah ada (domain → data → app/api → presentation):

| Lapisan | File | Isi |
|---|---|---|
| Domain | `src/domain/models/PortfolioHolding.ts` | Tipe `PortfolioHolding`, `NewPortfolioHoldingInput`, serta fungsi murni `computeHoldingMetrics(holding, lastClose)` dan `computePortfolioSummary(holdings, priceByTicker)`. |
| Data | `src/data/repositories/PortfolioRepository.ts` | Server-only CRUD (`listHoldings`, `addHolding`, `updateHolding`, `deleteHolding`) memakai `createClient()` dari `src/lib/supabase/server.ts`. Kepemilikan ditegakkan oleh RLS. `user_id` diisi dari `supabase.auth.getUser()` di server, **tidak pernah** dari body request. |
| API | `src/app/api/portfolio/route.ts` | `GET` (list) dan `POST` (tambah). |
| API | `src/app/api/portfolio/[id]/route.ts` | `PATCH` (edit) dan `DELETE` (hapus). |
| Presentation | `src/presentation/features/portfolio/usePortfolio.ts` | Hook fetch + mutasi, refetch setelah mutasi (seperti `useJournal`). |
| Presentation | `src/presentation/features/portfolio/PortfolioPage.tsx` dan komponennya | Tabel/kartu, ringkasan, form modal tambah/edit, konfirmasi hapus. |
| App | `src/app/portofolio/page.tsx` | Entry halaman. |

Bentuk respons API sama dengan `src/app/api/journal/route.ts`:

```ts
{ ok: true, holdings: PortfolioHolding[] }
{ ok: false, message: string, holdings: [] }
```

- `401` dengan `message: 'Silakan login terlebih dahulu'` jika tidak ada session.
- `400` untuk validasi gagal (ticker tidak dikenal, lot ≤ 0, available > balance).
- `409` untuk ticker yang sudah ada.

Validasi dijalankan **dua kali**: di client (form) dan di server (route handler). Constraint Postgres menjadi lapisan terakhir.

> Catatan implementer: proyek ini memakai Next.js 16. Baca panduan terkait di `node_modules/next/dist/docs/` sebelum menulis Route Handler atau page (lihat `AGENTS.md`).

Environment variable yang dibutuhkan sudah ada: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Tidak perlu service-role key karena semua akses berjalan sebagai user lewat RLS.

## 9. Validasi & Edge Case

| Kasus | Perilaku |
|---|---|
| Ticker tidak ada di daftar saham | Ditolak: "Kode saham tidak ditemukan". |
| Ticker duplikat | Ditolak (409), dengan tawaran untuk mengedit holding yang ada. |
| `available_lot` > `balance_lot` | Ditolak. |
| Lot desimal (odd lot) | Diterima hingga 2 desimal. Lembar = lot × 100, dibulatkan ke bilangan bulat. |
| Harga terakhir tidak tersedia / saham suspend | P/L tampil `–`, tidak masuk total, diberi badge "Harga tidak tersedia". |
| Saham delisting | Tetap tampil dengan badge peringatan. User bisa menghapus sendiri. |
| Session habis saat submit | API mengembalikan 401, UI menampilkan ajakan login ulang tanpa menghilangkan isi form. |
| Portofolio kosong | Empty state dengan tombol **Tambah Saham** pertama. |

## 10. Fase Berikutnya

- **Riwayat transaksi** (`portfolio_transactions`: buy/sell, tanggal, lot, harga, fee). Average price dan realized P/L dihitung otomatis dari transaksi, dan `portfolio_holdings` menjadi hasil agregasinya.
- **Import CSV/paste** dari aplikasi sekuritas (kolom Symbol, Balance Lot, Available Lot, Average Price), dengan pratinjau sebelum disimpan.
- Pencatatan dividen dan corporate action.
- Grafik alokasi per sektor dan per saham.
- Riwayat nilai portofolio harian (snapshot EOD) dan perbandingan dengan IHSG.
- Notifikasi jika holding menembus support atau stop loss.

## 11. Acceptance Criteria

- [ ] User login bisa menambah, mengedit, dan menghapus holding. Perubahan tetap ada setelah reload dan di device lain.
- [ ] User A **tidak bisa** membaca atau mengubah holding user B, termasuk lewat panggilan API langsung dengan `id` milik user B (uji RLS).
- [ ] Angka modal, nilai pasar, dan P/L sama dengan hitungan manual. Contoh: BBRI 35 lot @ Rp3.334,91 menghasilkan modal Rp11.672.185.
- [ ] Odd lot (0,97 lot) tersimpan dan dihitung benar (97 lembar).
- [ ] Holding tanpa harga tidak merusak total.
- [ ] Kolom Status konsisten dengan kartu 10-Second Review di halaman analisis untuk ticker yang sama.
- [ ] Guest yang membuka `/portofolio` melihat ajakan login, bukan error.
- [ ] Tidak ada teks yang menjanjikan profit atau memerintahkan jual/beli.
