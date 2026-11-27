-- Portofolio saham per user. Jalankan di Supabase Dashboard → SQL Editor.

-- Semua objek ezysaham ada di schema `ezysaham` (bukan `public`), karena project Supabase ini
-- juga dipakai aplikasi lain. Schema ini harus ditambahkan ke Settings → Data API → Exposed schemas.
create schema if not exists ezysaham;
grant usage on schema ezysaham to authenticated, service_role;

create table if not exists ezysaham.portfolio_holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol      text not null check (symbol ~ '^[A-Z0-9]{2,8}$'),
  avg_price   numeric(18, 4) not null check (avg_price > 0),
  shares      bigint not null check (shares > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists portfolio_holdings_user_idx on ezysaham.portfolio_holdings (user_id);

-- updated_at otomatis
create or replace function ezysaham.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolio_holdings_updated_at on ezysaham.portfolio_holdings;
create trigger portfolio_holdings_updated_at
  before update on ezysaham.portfolio_holdings
  for each row execute function ezysaham.set_updated_at();

-- Row Level Security: user hanya bisa mengakses miliknya sendiri
alter table ezysaham.portfolio_holdings enable row level security;

drop policy if exists "holdings_select_own" on ezysaham.portfolio_holdings;
create policy "holdings_select_own" on ezysaham.portfolio_holdings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "holdings_insert_own" on ezysaham.portfolio_holdings;
create policy "holdings_insert_own" on ezysaham.portfolio_holdings
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "holdings_update_own" on ezysaham.portfolio_holdings;
create policy "holdings_update_own" on ezysaham.portfolio_holdings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "holdings_delete_own" on ezysaham.portfolio_holdings;
create policy "holdings_delete_own" on ezysaham.portfolio_holdings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Hak akses tabel (baris tetap dibatasi RLS di atas)
grant select, insert, update, delete on ezysaham.portfolio_holdings to authenticated;
grant all on ezysaham.portfolio_holdings to service_role;
