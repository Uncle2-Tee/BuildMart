alter table public.orders
  add column if not exists delivery_name text,
  add column if not exists delivery_phone text,
  add column if not exists delivery_region text,
  add column if not exists delivery_city text,
  add column if not exists delivery_address text,
  add column if not exists delivery_digital_address text,
  add column if not exists delivery_instructions text;

notify pgrst, 'reload schema';
