alter table public.orders
  alter column buyer_id drop not null;

notify pgrst, 'reload schema';
