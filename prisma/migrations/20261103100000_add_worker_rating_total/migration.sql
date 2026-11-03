begin;

alter table public.worker_profiles
  add column if not exists rating_total integer not null default 0
  check (rating_total >= 0);

update public.worker_profiles as worker
set
  rating_total = totals.rating_total,
  rating_count = totals.rating_count,
  rating_average = totals.rating_average
from (
  select
    worker.id,
    coalesce(sum(rating.stars), 0)::integer as rating_total,
    count(rating.id)::integer as rating_count,
    coalesce(round(avg(rating.stars)::numeric, 2), 0) as rating_average
  from public.worker_profiles as worker
  left join public.worker_ratings as rating on rating.worker_id = worker.id
  group by worker.id
) as totals
where worker.id = totals.id;

create or replace function public.update_worker_profile_rating_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.worker_profiles
  set
    rating_total = rating_total + new.stars,
    rating_average = round(
      ((rating_average * rating_count + new.stars)::numeric / (rating_count + 1)),
      2
    ),
    rating_count = rating_count + 1
  where id = new.worker_id;

  return new;
end;
$$;

create trigger worker_ratings_update_profile_totals
after insert on public.worker_ratings
for each row
execute function public.update_worker_profile_rating_totals();

notify pgrst, 'reload schema';

commit;
