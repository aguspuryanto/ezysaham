-- Watchlist saham per user. Jalankan di Supabase Dashboard → SQL Editor.

-- Semua objek ezysaham ada di schema `ezysaham` (bukan `public`), karena project Supabase ini
-- juga dipakai aplikasi lain. Schema ini harus ditambahkan ke Settings → Data API → Exposed schemas.
create schema if not exists ezysaham;
grant usage on schema ezysaham to authenticated, service_role;

-- updated_at otomatis (aman dijalankan ulang)
create or replace function ezysaham.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists ezysaham.watchlist_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol        text not null check (symbol ~ '^[A-Z0-9]{2,8}$'),
  -- Fitur Pro (dibatasi di aplikasi): catatan & target harga
  note          text check (char_length(note) <= 500),
  target_price  numeric(18, 4) check (target_price > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists watchlist_items_user_idx on ezysaham.watchlist_items (user_id);

drop trigger if exists watchlist_items_updated_at on ezysaham.watchlist_items;
create trigger watchlist_items_updated_at
  before update on ezysaham.watchlist_items
  for each row execute function ezysaham.set_updated_at();

-- Row Level Security: user hanya bisa mengakses miliknya sendiri
alter table ezysaham.watchlist_items enable row level security;

drop policy if exists "watchlist_select_own" on ezysaham.watchlist_items;
create policy "watchlist_select_own" on ezysaham.watchlist_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "watchlist_insert_own" on ezysaham.watchlist_items;
create policy "watchlist_insert_own" on ezysaham.watchlist_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist_update_own" on ezysaham.watchlist_items;
create policy "watchlist_update_own" on ezysaham.watchlist_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "watchlist_delete_own" on ezysaham.watchlist_items;
create policy "watchlist_delete_own" on ezysaham.watchlist_items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Hak akses tabel (baris tetap dibatasi RLS di atas)
grant select, insert, update, delete on ezysaham.watchlist_items to authenticated;
grant all on ezysaham.watchlist_items to service_role;
