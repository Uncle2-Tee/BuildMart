begin;

alter table public.worker_bookings
  drop constraint if exists worker_bookings_status_check;

alter table public.worker_bookings
  add constraint worker_bookings_status_check
  check (status in ('pending', 'accepted', 'declined', 'in_progress', 'completed', 'cancelled'));

notify pgrst, 'reload schema';

commit;
