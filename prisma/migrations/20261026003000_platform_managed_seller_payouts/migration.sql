alter table public.profiles
  drop column if exists paystack_subaccount_code,
  add column if not exists paystack_recipient_code text;

create unique index if not exists profiles_paystack_recipient_code_key
  on public.profiles(paystack_recipient_code)
  where paystack_recipient_code is not null;

create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'GHS' check (currency = 'GHS'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'needs_otp', 'paid', 'failed', 'review')),
  active_transfer_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, order_id)
);

create unique index if not exists seller_payouts_active_transfer_reference_key
  on public.seller_payouts(active_transfer_reference)
  where active_transfer_reference is not null;

create index if not exists seller_payouts_seller_status_created_at_idx
  on public.seller_payouts(seller_id, status, created_at desc);

create table if not exists public.seller_payout_transfers (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.seller_payouts(id) on delete restrict,
  reference text not null unique,
  transfer_code text,
  status text not null
    check (status in ('processing', 'needs_otp', 'success', 'failed', 'review', 'cancelled')),
  provider_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seller_payout_transfers_payout_created_at_idx
  on public.seller_payout_transfers(payout_id, created_at desc);

alter table public.seller_payouts enable row level security;
alter table public.seller_payout_transfers enable row level security;
