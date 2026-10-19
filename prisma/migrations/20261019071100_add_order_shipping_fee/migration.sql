alter table public.orders
  add column if not exists shipping_fee_kobo integer not null default 0;

notify pgrst, 'reload schema';
