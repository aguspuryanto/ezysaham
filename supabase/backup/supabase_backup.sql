-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE ezysaham.portfolio_holdings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,8}$'::text),
  avg_price numeric NOT NULL CHECK (avg_price > 0::numeric),
  shares bigint NOT NULL CHECK (shares > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_holdings_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_holdings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE ezysaham.memberships (
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'pro'::text CHECK (plan = 'pro'::text),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT memberships_pkey PRIMARY KEY (user_id),
  CONSTRAINT memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE ezysaham.membership_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  external_id text NOT NULL UNIQUE,
  gateway text NOT NULL DEFAULT 'doku'::text,
  gateway_ref text,
  plan text NOT NULL DEFAULT 'pro'::text CHECK (plan = 'pro'::text),
  period text NOT NULL CHECK (period = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  amount bigint NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'IDR'::text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'failed'::text])),
  invoice_url text,
  invoice_expires_at timestamp with time zone,
  payment_method text,
  payment_channel text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT membership_payments_pkey PRIMARY KEY (id),
  CONSTRAINT membership_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE ezysaham.watchlist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,8}$'::text),
  note text CHECK (char_length(note) <= 500),
  target_price numeric CHECK (target_price > 0::numeric),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT watchlist_items_pkey PRIMARY KEY (id),
  CONSTRAINT watchlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE ezysaham.portfolio_sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL CHECK (symbol ~ '^[A-Z0-9]{2,8}$'::text),
  shares bigint NOT NULL CHECK (shares > 0),
  buy_price numeric NOT NULL CHECK (buy_price > 0::numeric),
  sell_price numeric NOT NULL CHECK (sell_price > 0::numeric),
  buy_fee numeric NOT NULL DEFAULT 0 CHECK (buy_fee >= 0::numeric),
  sell_fee numeric NOT NULL DEFAULT 0 CHECK (sell_fee >= 0::numeric),
  sold_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_sales_pkey PRIMARY KEY (id),
  CONSTRAINT portfolio_sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);