-- Portofolio saham per user. Jalankan di Supabase Dashboard → SQL Editor.

create table if not exists public.portfolio_holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol      text not null check (symbol ~ '^[A-Z0-9]{2,8}$'),
  avg_price   numeric(18, 4) not null check (avg_price > 0),
  shares      bigint not null check (shares > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists portfolio_holdings_user_idx on public.portfolio_holdings (user_id);

-- updated_at otomatis
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolio_holdings_updated_at on public.portfolio_holdings;
create trigger portfolio_holdings_updated_at
  before update on public.portfolio_holdings
  for each row execute function public.set_updated_at();

-- Row Level Security: user hanya bisa mengakses miliknya sendiri
alter table public.portfolio_holdings enable row level security;

drop policy if exists "holdings_select_own" on public.portfolio_holdings;
create policy "holdings_select_own" on public.portfolio_holdings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "holdings_insert_own" on public.portfolio_holdings;
create policy "holdings_insert_own" on public.portfolio_holdings
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "holdings_update_own" on public.portfolio_holdings;
create policy "holdings_update_own" on public.portfolio_holdings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "holdings_delete_own" on public.portfolio_holdings;
create policy "holdings_delete_own" on public.portfolio_holdings
  for delete to authenticated using ((select auth.uid()) = user_id);
