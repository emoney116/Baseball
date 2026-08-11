-- Seed a small public discovery directory so coaches can test search and follows.
-- These organizations/teams are public directory examples only; they do not grant
-- workspace access or create memberships.

alter table public.organizations
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists logo_url text;

insert into public.organizations (id, name, slug, visibility, city, state)
values
  ('8d7b9b66-5b46-4c84-82d3-3d61c3ad1001', 'Charlotte Christian School', 'charlotte-christian-school', 'PUBLIC', 'Charlotte', 'NC'),
  ('8d7b9b66-5b46-4c84-82d3-3d61c3ad1002', 'Providence Day School', 'providence-day-school', 'PUBLIC', 'Charlotte', 'NC'),
  ('8d7b9b66-5b46-4c84-82d3-3d61c3ad1003', 'Charlotte Baseball Club', 'charlotte-baseball-club', 'PUBLIC', 'Charlotte', 'NC'),
  ('8d7b9b66-5b46-4c84-82d3-3d61c3ad1004', 'South Charlotte Baseball', 'south-charlotte-baseball', 'PUBLIC', 'Charlotte', 'NC'),
  ('8d7b9b66-5b46-4c84-82d3-3d61c3ad1005', 'Pineville Post 80', 'pineville-post-80', 'PUBLIC', 'Pineville', 'NC')
on conflict (slug) do update
set
  name = excluded.name,
  visibility = excluded.visibility,
  city = excluded.city,
  state = excluded.state,
  updated_at = now();

insert into public.teams (id, organization_id, name, level, active, visibility)
values
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2001', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1001', 'Charlotte Christian Varsity', 'Varsity', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2002', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1001', 'Charlotte Christian JV', 'JV', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2003', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1002', 'Providence Day Varsity', 'Varsity', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2004', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1003', 'Charlotte Baseball Club 17U', '17U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2005', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1003', 'Charlotte Baseball Club 15U', '15U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2006', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1004', 'South Charlotte Elite 16U', '16U', true, 'PUBLIC'),
  ('9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2007', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1005', 'Pineville Post 80 Legion', 'American Legion', true, 'PUBLIC')
on conflict (organization_id, name) do update
set
  level = excluded.level,
  active = excluded.active,
  visibility = excluded.visibility,
  updated_at = now();

insert into public.seasons (id, organization_id, team_id, name, starts_on, ends_on, active)
values
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3001', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1001', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2001', 'Fall 2026', '2026-08-01', '2026-11-30', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3002', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1001', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2002', 'Fall 2026', '2026-08-01', '2026-11-30', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3003', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1002', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2003', 'Fall 2026', '2026-08-01', '2026-11-30', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3004', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1003', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2004', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3005', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1003', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2005', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3006', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1004', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2006', 'Summer 2027', '2027-05-15', '2027-08-15', true),
  ('aa4c0b00-42ed-47fa-95af-7c8ed9ce3007', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1005', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2007', 'Summer 2027', '2027-05-15', '2027-08-15', true)
on conflict (team_id, name) do update
set
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  active = excluded.active,
  updated_at = now();
