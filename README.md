# EzySaham (Next.js)

Website pendamping aplikasi mobile EzySaham: screener saham BEI, chart candlestick + indikator, portofolio, dan tips untuk pemula. Dibangun mengikuti `PLAN.txt`.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Opsional: salin `.env.example` ke `.env.local` untuk mengganti `EZYSAHAM_API_BASE`.

## Login (magic link) & portofolio di Supabase

Tanpa env Supabase, website tetap berjalan dalam mode tamu (portofolio di localStorage, tombol Masuk disembunyikan).

1. Buat project di https://supabase.com, lalu isi `.env.local` (lihat `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (atau `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Restart `npm run dev`.
2. **SQL Editor** → jalankan `supabase/migrations/0001_portfolio_holdings.sql`.
3. **Authentication → URL Configuration**
   - Site URL: `http://localhost:3000` (ganti dengan domain produksi saat deploy)
   - Redirect URLs: `http://localhost:3000/auth/callback` dan `https://<domain-produksi>/auth/callback`
4. **Authentication → Sign In / Providers → Email**: pastikan aktif (default).
5. *(Disarankan)* **Authentication → Email Templates → Magic Link**, ganti link menjadi
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
   agar link bisa dibuka di perangkat/browser lain (template bawaan memakai PKCE yang harus dibuka di browser yang sama).
6. *(Produksi)* **Project Settings → Authentication → SMTP**: pasang SMTP sendiri (mis. Resend). SMTP bawaan Supabase dibatasi beberapa email per jam.

Alur: `/login` → email berisi link → `/auth/callback` memverifikasi → valid: redirect ke `/`, tidak valid/kedaluwarsa: kembali ke `/login` dengan pesan error.
Setelah login pertama, holding yang tersimpan di localStorage ditawarkan untuk diimpor ke akun.

## Struktur

```
src/app/(dashboard)/          page.tsx (Pasar), screener/, stock/[symbol]/, portfolio/, news/
src/app/api/stocks/...        BFF proxy ke ezysaham (stocks, history, fundamentals)
src/components/               ui/, layout/, dashboard/, charts/, portfolio/
src/lib/                      api.ts, indicators.ts, screener.ts, dividends.ts, types.ts, format.ts, articles.ts
src/hooks/                    usePortfolio.ts (localStorage), useStockList.ts
```

## Catatan data

- Respons API asli berbeda dari contoh di PLAN; `lib/api.ts` menormalisasinya ke tipe `Stock`, `Candle`, dan `Fundamentals`.
- Cache: daftar saham 5 menit, history 10 menit, fundamental 1 jam.
- Dividend yield hanya ada di endpoint fundamentals, jadi **Top Dividen** dihitung dari 40 saham berkapitalisasi terbesar.
- **Top Akumulasi** memakai heuristik: harga sideways (±5% sebulan, ±3% sepekan), transaksi ramai, dan harga ditutup dekat high harian.
