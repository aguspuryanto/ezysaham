-- Riwayat penjualan saham (untung/rugi terealisasi). Jalankan di Supabase Dashboard → SQL Editor.
-- Aman dijalankan ulang.

create table if not exists ezysaham.portfolio_sales (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  symbol      text not null check (symbol ~ '^[A-Z0-9]{2,8}$'),
  shares      bigint not null check (shares > 0),
  -- Harga beli rata-rata saat dijual (tanpa fee)
  buy_price   numeric(18, 4) not null check (buy_price > 0),
  sell_price  numeric(18, 4) not null check (sell_price > 0),
  buy_fee     numeric(18, 2) not null default 0 check (buy_fee >= 0),
  sell_fee    numeric(18, 2) not null default 0 check (sell_fee >= 0),
  sold_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists portfolio_sales_user_idx on ezysaham.portfolio_sales (user_id, sold_at desc);

alter table ezysaham.portfolio_sales enable row level security;

drop policy if exists "sales_select_own" on ezysaham.portfolio_sales;
create policy "sales_select_own" on ezysaham.portfolio_sales
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "sales_insert_own" on ezysaham.portfolio_sales;
create policy "sales_insert_own" on ezysaham.portfolio_sales
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "sales_delete_own" on ezysaham.portfolio_sales;
create policy "sales_delete_own" on ezysaham.portfolio_sales
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on ezysaham.portfolio_sales to authenticated;
grant all on ezysaham.portfolio_sales to service_role;

-- Jual saham secara atomik: catat ke riwayat + kurangi/hapus holding dalam satu transaksi.
-- security invoker → RLS tetap berlaku, user hanya bisa menjual miliknya sendiri.
create or replace function ezysaham.sell_holding(
  p_id         uuid,
  p_symbol     text,
  p_shares     bigint,
  p_sell_price numeric,
  p_buy_fee    numeric,
  p_sell_fee   numeric,
  p_sold_at    timestamptz
)
returns ezysaham.portfolio_sales
language plpgsql
security invoker
set search_path = ezysaham
as $$
declare
  h ezysaham.portfolio_holdings;
  s ezysaham.portfolio_sales;
begin
  select * into h from ezysaham.portfolio_holdings
   where user_id = auth.uid() and symbol = p_symbol
   for update;
  if not found then
    raise exception 'Saham % tidak ada di portofolio', p_symbol;
  end if;
  if p_shares <= 0 or p_shares > h.shares then
    raise exception 'Jumlah jual melebihi kepemilikan (% lembar)', h.shares;
  end if;

  insert into ezysaham.portfolio_sales (id, symbol, shares, buy_price, sell_price, buy_fee, sell_fee, sold_at)
  values (coalesce(p_id, gen_random_uuid()), p_symbol, p_shares, h.avg_price, p_sell_price, p_buy_fee, p_sell_fee, coalesce(p_sold_at, now()))
  returning * into s;

  if p_shares = h.shares then
    delete from ezysaham.portfolio_holdings where id = h.id;
  else
    update ezysaham.portfolio_holdings set shares = shares - p_shares where id = h.id;
  end if;

  return s;
end;
$$;

revoke all on function ezysaham.sell_holding(uuid, text, bigint, numeric, numeric, numeric, timestamptz) from public, anon;
grant execute on function ezysaham.sell_holding(uuid, text, bigint, numeric, numeric, numeric, timestamptz) to authenticated;

notify pgrst, 'reload schema';
