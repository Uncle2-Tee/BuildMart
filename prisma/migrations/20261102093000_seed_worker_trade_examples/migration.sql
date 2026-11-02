insert into public.worker_profiles (
  id,
  name,
  trade,
  bio,
  location,
  phone,
  years_experience,
  hourly_rate_kobo,
  is_active,
  approval_status
)
values
  ('00000000-0000-4000-8000-000000000001', 'Demo Mason', 'Mason', 'Sample masonry profile for directory testing. Replace or remove this example before launch.', 'Accra', '0200000001', 8, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000002', 'Demo Painter', 'Painter', 'Sample painting profile for directory testing. Replace or remove this example before launch.', 'Kumasi', '0200000002', 6, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000003', 'Demo Labourer', 'Labourer', 'Sample labourer profile for directory testing. Replace or remove this example before launch.', 'Tema', '0200000003', 5, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000004', 'Demo Tiler', 'Tiler', 'Sample tiling profile for directory testing. Replace or remove this example before launch.', 'Takoradi', '0200000004', 7, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000005', 'Demo Carpenter', 'Carpenter', 'Sample carpentry profile for directory testing. Replace or remove this example before launch.', 'Cape Coast', '0200000005', 9, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000006', 'Demo Electrician', 'Electrician', 'Sample electrical profile for directory testing. Replace or remove this example before launch.', 'Accra', '0200000006', 10, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000007', 'Demo Plumber', 'Plumber', 'Sample plumbing profile for directory testing. Replace or remove this example before launch.', 'Tema', '0200000007', 8, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000008', 'Demo Welder', 'Welder', 'Sample welding profile for directory testing. Replace or remove this example before launch.', 'Kumasi', '0200000008', 7, null, true, 'approved'),
  ('00000000-0000-4000-8000-000000000009', 'Demo General Professional', 'Other', 'Sample general professional profile for directory testing. Replace or remove this example before launch.', 'Sunyani', '0200000009', 4, null, true, 'approved')
on conflict (id) do update set
  name = excluded.name,
  trade = excluded.trade,
  bio = excluded.bio,
  location = excluded.location,
  phone = excluded.phone,
  years_experience = excluded.years_experience,
  hourly_rate_kobo = excluded.hourly_rate_kobo,
  is_active = excluded.is_active,
  approval_status = excluded.approval_status;

-- Remove these examples before production:
-- delete from public.worker_profiles
-- where id in (
--   '00000000-0000-4000-8000-000000000001',
--   '00000000-0000-4000-8000-000000000002',
--   '00000000-0000-4000-8000-000000000003',
--   '00000000-0000-4000-8000-000000000004',
--   '00000000-0000-4000-8000-000000000005',
--   '00000000-0000-4000-8000-000000000006',
--   '00000000-0000-4000-8000-000000000007',
--   '00000000-0000-4000-8000-000000000008',
--   '00000000-0000-4000-8000-000000000009'
-- );
