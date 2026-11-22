-- Membership Pro + riwayat pembayaran Xendit. Jalankan di Supabase Dashboard → SQL Editor
-- (setelah 0001_portfolio_holdings.sql).
--
-- Penulisan HANYA dilakukan server (service role) dari webhook/checkout.
-- User hanya bisa MEMBACA baris miliknya sendiri.

-- updated_at otomatis (aman dijalankan ulang)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Status membership per user ----------
create table if not exists public.memberships (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  plan        text not null default 'pro' check (plan in ('pro')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists memberships_updated_at on public.memberships;
create trigger memberships_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

alter table public.memberships enable row level security;

drop policy if exists "memberships_select_own" on public.memberships;
create policy "memberships_select_own" on public.memberships
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- Riwayat invoice / pembayaran ----------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  external_id        text not null unique,
  xendit_invoice_id  text unique,
  plan               text not null default 'pro' check (plan in ('pro')),
  period             text not null check (period in ('monthly', 'yearly')),
  amount             bigint not null check (amount > 0),
  currency           text not null default 'IDR',
  status             text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed')),
  invoice_url        text,
  invoice_expires_at timestamptz,
  payment_method     text,
  payment_channel    text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists payments_user_created_idx on public.payments (user_id, created_at desc);

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- Aktivasi atomik & idempoten ----------
-- Dipanggil webhook saat invoice PAID. Bila invoice sudah pernah diproses → return null (tidak dobel).
-- Masa aktif diperpanjang dari tanggal berakhir saat ini (bila masih aktif) atau dari sekarang.
create or replace function public.activate_membership(
  p_external_id text,
  p_invoice_id  text,
  p_paid_amount bigint,
  p_paid_at     timestamptz,
  p_method      text,
  p_channel     text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_period  text;
  v_amount  bigint;
  v_add     interval;
  v_expires timestamptz;
begin
  update payments
     set status = 'paid',
         paid_at = coalesce(p_paid_at, now()),
         xendit_invoice_id = coalesce(xendit_invoice_id, p_invoice_id),
         payment_method = p_method,
         payment_channel = p_channel
   where external_id = p_external_id
     and status <> 'paid'
  returning user_id, period, amount into v_user, v_period, v_amount;

  if v_user is null then
    return null; -- tidak ditemukan / sudah diproses
  end if;

  if p_paid_amount is not null and p_paid_amount < v_amount then
    raise exception 'Jumlah dibayar (%) kurang dari tagihan (%)', p_paid_amount, v_amount;
  end if;

  v_add := case when v_period = 'yearly' then interval '1 year' else interval '1 month' end;

  insert into memberships (user_id, plan, expires_at)
  values (v_user, 'pro', now() + v_add)
  on conflict (user_id) do update
     set expires_at = greatest(memberships.expires_at, now()) + v_add
  returning expires_at into v_expires;

  return v_expires;
end;
$$;

revoke all on function public.activate_membership(text, text, bigint, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.activate_membership(text, text, bigint, timestamptz, text, text) to service_role;
