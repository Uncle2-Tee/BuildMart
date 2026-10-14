create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role text not null default 'buyer' check (role in ('buyer', 'seller', 'admin')),
  seller_status text not null default 'not_applicable'
    check (seller_status in ('not_applicable', 'pending', 'approved', 'rejected')),
  paystack_subaccount_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null,
  price_kobo bigint not null check (price_kobo > 0),
  image_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'checkout_failed')),
  total_kobo bigint not null check (total_kobo > 0),
  currency text not null default 'GHS' check (currency = 'GHS'),
  payment_reference text not null unique,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  product_title text not null,
  unit_price_kobo bigint not null check (unit_price_kobo > 0),
  quantity integer not null check (quantity between 1 and 99),
  created_at timestamptz not null default now()
);

create index if not exists products_seller_created_idx
  on public.products (seller_id, created_at desc);
create index if not exists products_active_created_idx
  on public.products (active, created_at desc);
create index if not exists orders_buyer_created_idx
  on public.orders (buyer_id, created_at desc);
create index if not exists order_items_order_seller_idx
  on public.order_items (order_id, seller_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'account_role' in ('buyer', 'seller')
      then new.raw_user_meta_data ->> 'account_role'
    else 'buyer'
  end;

  insert into public.profiles (id, display_name, role, seller_status)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80),
    requested_role,
    case when requested_role = 'seller' then 'pending' else 'not_applicable' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists buildmart_create_profile on auth.users;
create trigger buildmart_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_approved_seller(seller_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = seller_user_id and role = 'seller' and seller_status = 'approved'
  );
$$;

create or replace function public.is_seller_order(order_uuid uuid, seller_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.order_items
    where order_id = order_uuid and seller_id = seller_user_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Profiles are visible to their owner and admins" on public.profiles;
create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Active products are public" on public.products;
create policy "Active products are public"
  on public.products for select to anon, authenticated
  using (
    public.is_admin()
    or seller_id = auth.uid()
    or (active and public.is_approved_seller(seller_id))
  );

drop policy if exists "Approved sellers create their own products" on public.products;
create policy "Approved sellers create their own products"
  on public.products for insert to authenticated
  with check (
    seller_id = auth.uid()
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "Approved sellers and admins update products" on public.products;
create policy "Approved sellers and admins update products"
  on public.products for update to authenticated
  using (
    public.is_admin()
    or (seller_id = auth.uid() and public.is_approved_seller(auth.uid()))
  )
  with check (
    public.is_admin()
    or (seller_id = auth.uid() and public.is_approved_seller(auth.uid()))
  );

drop policy if exists "Product owners and admins delete products" on public.products;
create policy "Product owners and admins delete products"
  on public.products for delete to authenticated
  using (
    public.is_admin()
    or (seller_id = auth.uid() and public.is_approved_seller(auth.uid()))
  );

drop policy if exists "Buyers see their orders, sellers see their own, admins see all" on public.orders;
create policy "Buyers see their orders, sellers see their own, admins see all"
  on public.orders for select to authenticated
  using (
    public.is_admin()
    or buyer_id = auth.uid()
    or public.is_seller_order(id, auth.uid())
  );

drop policy if exists "Order participants and admins see order items" on public.order_items;
create policy "Order participants and admins see order items"
  on public.order_items for select to authenticated
  using (
    public.is_admin()
    or seller_id = auth.uid()
    or exists (
      select 1 from public.orders
      where id = order_id and buyer_id = auth.uid()
    )
  );

grant select on public.products to anon, authenticated;
grant select on public.profiles, public.orders, public.order_items to authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.profiles, public.products, public.orders, public.order_items to service_role;

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Product images are publicly readable" on storage.objects;
create policy "Product images are publicly readable"
  on storage.objects for select to public
  using (bucket_id = 'products');

drop policy if exists "Approved sellers upload their own product images" on storage.objects;
create policy "Approved sellers upload their own product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_seller(auth.uid())
  );

drop policy if exists "Sellers and admins remove product images" on storage.objects;
create policy "Sellers and admins remove product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'products'
    and (
      public.is_admin()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and public.is_approved_seller(auth.uid())
      )
    )
  );
