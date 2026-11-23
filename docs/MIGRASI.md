Bisa, dan sudah saya pindahkan ke schema `ezysaham`. TypeScript lolos, tapi SQL-nya belum dijalankan ke database. Perubahan ini **belum di-commit** dan sebaiknya jangan di-deploy sebelum database siap (urutannya di bawah).

**Perubahan di kode** (cukup diatur di tiga client Supabase, kode lain tidak perlu diubah):
- [config.ts](src/lib/supabase/config.ts): menambahkan `DB_SCHEMA = "ezysaham"` dan tipe `EzyClient`.
- [client.ts](src/lib/supabase/client.ts), [server.ts](src/lib/supabase/server.ts), [admin.ts](src/lib/supabase/admin.ts): ketiga client sekarang memakai `db: { schema: DB_SCHEMA }`. Semua `.from()` dan `.rpc("activate_membership")` otomatis mengarah ke `ezysaham`. Login (`auth.users`) tidak terpengaruh.
- [payments.ts](src/lib/payments.ts): tipe parameter ikut diganti ke `EzyClient`.

**Perubahan di migrations:**
- **0001–0003** sekarang langsung membuat semuanya di `ezysaham` (schema, tabel, `ezysaham.set_updated_at()`, `activate_membership` dengan `search_path = ezysaham`). Saya juga menambahkan hak akses per tabel:
  - portfolio dan watchlist: user login bisa baca, tambah, ubah, hapus.
  - memberships dan membership_payments: user login hanya bisa membaca.
  - service role: akses penuh.
- **[0004_move_to_ezysaham_schema.sql](supabase/migrations/0004_move_to_ezysaham_schema.sql)** (baru) untuk database yang tabelnya sudah ada di `public`:
  - Memindahkan tabel dengan `alter table ... set schema`, jadi data, index, dan RLS policy ikut pindah.
  - Mengarahkan ulang trigger `updated_at`, memindahkan `activate_membership`, dan merapikan hak akses (akses `anon` yang terbawa dari `public` dicabut).
  - Aman dijalankan ulang. Kalau sebuah tabel ternyata ada di kedua schema, skrip berhenti tanpa mengubah apa pun.
  - `public.set_updated_at()` sengaja tidak dihapus karena mungkin dipakai tabel aplikasi lain di project Supabase yang sama.

**Urutan menerapkannya:**
1. Supabase → Settings → Data API → **Exposed schemas**: tambahkan `ezysaham`. Tanpa ini semua query akan error.
2. Di SQL Editor:
   - Kalau `0003_watchlist.sql` versi lama belum pernah dijalankan, jalankan `0003` yang baru dulu.
   - Lalu jalankan `0004`.
3. Commit dan deploy kode ini. Di antara langkah 2 dan 3, aplikasi yang sedang live tidak bisa membaca tabel-tabel ini (portofolio login, membership, pembayaran). Jadi lakukan berurutan dengan cepat, sebaiknya saat sepi.

Mau saya commit dan push sekarang, atau setelah migrasi di Supabase selesai?