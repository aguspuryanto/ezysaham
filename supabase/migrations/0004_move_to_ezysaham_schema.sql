-- Pindahkan tabel ezysaham dari schema `public` ke schema `ezysaham`.
-- HANYA untuk project yang dulu menjalankan versi lama 0001–0003 (yang membuat tabel di `public`).
-- Instalasi baru cukup menjalankan 0001–0003; skrip ini lalu tidak melakukan apa-apa.
-- Aman dijalankan ulang. Data, index, constraint & RLS policy ikut pindah bersama tabel.
--
-- Urutan deploy:
--   1. Settings → Data API → Exposed schemas: tambahkan `ezysaham`.
--   2. Jalankan skrip ini di SQL Editor.
--   3. Deploy kode yang memakai schema `ezysaham` (lib/supabase/*).
--   Di antara langkah 2 dan 3 aplikasi versi lama tidak bisa membaca/menulis tabel ini.

create schema if not exists ezysaham;
grant usage on schema ezysaham to authenticated, service_role;

create or replace function ezysaham.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['portfolio_holdings', 'memberships', 'membership_payments', 'watchlist_items'] loop
    if to_regclass(format('public.%I', t)) is not null then
      if to_regclass(format('ezysaham.%I', t)) is not null then
        raise exception 'Tabel % ada di public dan ezysaham sekaligus — periksa & gabungkan manual dulu.', t;
      end if;
      execute format('alter table public.%I set schema ezysaham', t);
      raise notice 'Dipindah: public.% → ezysaham.%', t, t;
    end if;

    -- Trigger updated_at diarahkan ke fungsi di schema ezysaham
    if to_regclass(format('ezysaham.%I', t)) is not null then
      execute format('drop trigger if exists %I on ezysaham.%I', t || '_updated_at', t);
      execute format(
        'create trigger %I before update on ezysaham.%I for each row execute function ezysaham.set_updated_at()',
        t || '_updated_at', t
      );
    end if;
  end loop;

  -- Fungsi aktivasi membership
  if to_regprocedure('public.activate_membership(text, text, bigint, timestamptz, text, text)') is not null then
    if to_regprocedure('ezysaham.activate_membership(text, text, bigint, timestamptz, text, text)') is not null then
      drop function public.activate_membership(text, text, bigint, timestamptz, text, text);
    else
      alter function public.activate_membership(text, text, bigint, timestamptz, text, text) set schema ezysaham;
    end if;
  end if;
  if to_regprocedure('ezysaham.activate_membership(text, text, bigint, timestamptz, text, text)') is not null then
    alter function ezysaham.activate_membership(text, text, bigint, timestamptz, text, text) set search_path = ezysaham;
    revoke all on function ezysaham.activate_membership(text, text, bigint, timestamptz, text, text) from public, anon, authenticated;
    grant execute on function ezysaham.activate_membership(text, text, bigint, timestamptz, text, text) to service_role;
  end if;

  -- Hak akses: tabel yang dipindah membawa grant bawaan `public` (termasuk anon) → rapikan
  execute 'revoke all on all tables in schema ezysaham from anon';
  execute 'grant all on all tables in schema ezysaham to service_role';
  if to_regclass('ezysaham.portfolio_holdings') is not null then
    execute 'grant select, insert, update, delete on ezysaham.portfolio_holdings to authenticated';
  end if;
  if to_regclass('ezysaham.watchlist_items') is not null then
    execute 'grant select, insert, update, delete on ezysaham.watchlist_items to authenticated';
  end if;
  if to_regclass('ezysaham.memberships') is not null then
    execute 'revoke insert, update, delete, truncate on ezysaham.memberships from authenticated';
    execute 'grant select on ezysaham.memberships to authenticated';
  end if;
  if to_regclass('ezysaham.membership_payments') is not null then
    execute 'revoke insert, update, delete, truncate on ezysaham.membership_payments from authenticated';
    execute 'grant select on ezysaham.membership_payments to authenticated';
  end if;
end;
$$;

-- Catatan: public.set_updated_at() sengaja TIDAK dihapus karena mungkin dipakai tabel aplikasi lain.
-- Bila yakin tidak dipakai: drop function if exists public.set_updated_at();

-- Muat ulang cache schema PostgREST
notify pgrst, 'reload schema';
