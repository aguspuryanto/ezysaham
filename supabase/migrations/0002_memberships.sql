-- Membership Pro + riwayat pembayaran (DOKU Checkout). Jalankan di Supabase Dashboard → SQL Editor
-- (setelah 0001_portfolio_holdings.sql). Aman dijalankan ulang.
--
-- Catatan: project Supabase ini juga dipakai aplikasi lain yang sudah punya tabel `public.payments`,
-- jadi tabel pembayaran ezysaham diberi nama `membership_payments` (tabel `payments` tidak disentuh).
--
-- Penulisan HANYA dilakukan server (service role) dari webhook/checkout.
-- User hanya bisa MEMBACA baris miliknya sendiri.

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

-- ---------- Status membership per user ----------
create table if not exists ezysaham.memberships (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  plan        text not null default 'pro' check (plan in ('pro')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists memberships_updated_at on ezysaham.memberships;
create trigger memberships_updated_at
  before update on ezysaham.memberships
  for each row execute function ezysaham.set_updated_at();

alter table ezysaham.memberships enable row level security;

drop policy if exists "memberships_select_own" on ezysaham.memberships;
create policy "memberships_select_own" on ezysaham.memberships
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- Riwayat pembayaran membership ----------
create table if not exists ezysaham.membership_payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  external_id        text not null unique,          -- invoice_number yang dikirim ke DOKU
  gateway            text not null default 'doku',
  gateway_ref        text,                          -- token_id DOKU Checkout
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

create index if not exists membership_payments_user_created_idx
  on ezysaham.membership_payments (user_id, created_at desc);

drop trigger if exists membership_payments_updated_at on ezysaham.membership_payments;
create trigger membership_payments_updated_at
  before update on ezysaham.membership_payments
  for each row execute function ezysaham.set_updated_at();

alter table ezysaham.membership_payments enable row level security;

drop policy if exists "membership_payments_select_own" on ezysaham.membership_payments;
create policy "membership_payments_select_own" on ezysaham.membership_payments
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- Aktivasi atomik & idempoten ----------
-- Dipanggil server saat transaksi SUCCESS. Bila sudah pernah diproses → return null (tidak dobel).
-- Masa aktif diperpanjang dari tanggal berakhir saat ini (bila masih aktif) atau dari sekarang.
drop function if exists ezysaham.activate_membership(text, text, bigint, timestamptz, text, text);
create function ezysaham.activate_membership(
  p_external_id text,
  p_gateway_ref text,
  p_paid_amount bigint,
  p_paid_at     timestamptz,
  p_method      text,
  p_channel     text
)
returns timestamptz
language plpgsql
security definer
set search_path = ezysaham
as $$
declare
  v_user    uuid;
  v_period  text;
  v_amount  bigint;
  v_add     interval;
  v_expires timestamptz;
begin
  update membership_payments
     set status = 'paid',
         paid_at = coalesce(p_paid_at, now()),
         gateway_ref = coalesce(gateway_ref, p_gateway_ref),
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

revoke all on function ezysaham.activate_membership(text, text, bigint, timestamptz, text, text) from public, anon, authenticated;
grant execute on function ezysaham.activate_membership(text, text, bigint, timestamptz, text, text) to service_role;

-- Hak akses tabel: user hanya membaca (RLS), penulisan lewat service role
grant select on ezysaham.memberships, ezysaham.membership_payments to authenticated;
grant all on ezysaham.memberships, ezysaham.membership_payments to service_role;
