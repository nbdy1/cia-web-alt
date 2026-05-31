-- Promote the Supabase auth user with this email to admin in public.profiles.
-- Run this in the Supabase SQL Editor.

insert into public.profiles (id, name, email, role)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), 'Admin'),
  u.email,
  'admin'
from auth.users u
where lower(u.email) = lower('admin@gmail.com')
on conflict (id) do update
set
  name = excluded.name,
  email = excluded.email,
  role = 'admin';

