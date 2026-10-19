create table if not exists public.seller_shop_applications (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null check (char_length(shop_name) between 2 and 100),
  shop_description text not null check (char_length(shop_description) between 20 and 1000),
  shop_location text not null check (char_length(shop_location) between 2 and 120),
  shop_phone text not null check (char_length(shop_phone) between 1 and 24),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.seller_shop_applications
  add column if not exists access_token_hash text,
  add column if not exists seller_id uuid references public.profiles(id);

alter table public.seller_shop_applications enable row level security;
revoke all on public.seller_shop_applications from anon, authenticated;
grant all on public.seller_shop_applications to service_role;

notify pgrst, 'reload schema';
