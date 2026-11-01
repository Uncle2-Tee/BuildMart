create table if not exists public.worker_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  trade text not null check (trade in ('Mason', 'Painter', 'Labourer', 'Tiler', 'Carpenter', 'Electrician', 'Plumber', 'Welder', 'Other')),
  bio text not null default '' check (char_length(bio) <= 1000),
  location text not null check (char_length(location) between 2 and 120),
  phone text not null check (char_length(phone) between 7 and 30),
  years_experience integer not null default 0 check (years_experience between 0 and 80),
  hourly_rate_kobo bigint check (hourly_rate_kobo is null or hourly_rate_kobo > 0),
  avatar_url text,
  is_active boolean not null default true,
  rating_average numeric(3, 2) not null default 0 check (rating_average between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create unique index if not exists worker_profiles_profile_id_key
  on public.worker_profiles(profile_id)
  where profile_id is not null;

create index if not exists worker_profiles_trade_active_idx
  on public.worker_profiles(trade, is_active, created_at desc);

create table if not exists public.worker_bookings (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  service_date date not null,
  address text not null check (char_length(address) between 5 and 300),
  request_details text not null check (char_length(request_details) between 10 and 1500),
  budget_kobo bigint check (budget_kobo is null or budget_kobo > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_bookings_worker_status_date_idx
  on public.worker_bookings(worker_id, status, service_date);

create table if not exists public.worker_ratings (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.worker_bookings(id) on delete restrict,
  worker_id uuid not null references public.worker_profiles(id) on delete restrict,
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  stars integer not null check (stars between 1 and 5),
  review text not null default '' check (char_length(review) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists worker_ratings_worker_created_at_idx
  on public.worker_ratings(worker_id, created_at desc);

alter table public.worker_profiles enable row level security;
alter table public.worker_bookings enable row level security;
alter table public.worker_ratings enable row level security;

notify pgrst, 'reload schema';
