begin;

insert into public.players (
  id,
  organization_id,
  first_name,
  last_name,
  jersey_number,
  graduation_year,
  primary_position,
  secondary_position,
  bats,
  throws,
  height,
  weight,
  is_pitcher,
  is_hitter,
  active
)
values
  ('14a00000-0000-4000-8000-000000000001', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Carson', 'Hill', 2, 2030, 'SS', 'RHP', 'R', 'R', '5''8"', 135, true, true, true),
  ('14a00000-0000-4000-8000-000000000002', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Mateo', 'Alvarez', 4, 2030, '2B', 'SS', 'R', 'R', '5''7"', 128, false, true, true),
  ('14a00000-0000-4000-8000-000000000003', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Liam', 'Brooks', 7, 2030, 'CF', 'LHP', 'L', 'L', '5''9"', 142, true, true, true),
  ('14a00000-0000-4000-8000-000000000004', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Nolan', 'Price', 9, 2030, 'C', '3B', 'R', 'R', '5''10"', 150, false, true, true),
  ('14a00000-0000-4000-8000-000000000005', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Jackson', 'Reed', 12, 2029, 'RHP', '1B', 'R', 'R', '6''0"', 165, true, true, true),
  ('14a00000-0000-4000-8000-000000000006', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Eli', 'Turner', 15, 2030, 'OF', 'P', 'L', 'R', '5''8"', 140, true, true, true),
  ('14a00000-0000-4000-8000-000000000007', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Caleb', 'Foster', 18, 2029, '3B', 'RHP', 'R', 'R', '6''1"', 172, true, true, true),
  ('14a00000-0000-4000-8000-000000000008', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Mason', 'Grant', 21, 2029, '1B', 'LHP', 'L', 'L', '6''2"', 180, true, true, true),
  ('14a00000-0000-4000-8000-000000000009', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Owen', 'Parker', 24, 2030, 'C', 'OF', 'R', 'R', '5''9"', 150, false, true, true),
  ('14a00000-0000-4000-8000-000000000010', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Tyler', 'Scott', 27, 2029, 'RHP', 'UTIL', 'R', 'R', '5''11"', 160, true, true, true),
  ('14a00000-0000-4000-8000-000000000011', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Ben', 'Walker', 32, 2030, 'OF', '2B', 'R', 'R', '5''8"', 138, false, true, true),
  ('14a00000-0000-4000-8000-000000000012', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', 'Noah', 'Campbell', 44, 2029, 'P', '1B', 'R', 'R', '6''1"', 175, true, true, true)
on conflict (id) do update
set
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  jersey_number = excluded.jersey_number,
  graduation_year = excluded.graduation_year,
  primary_position = excluded.primary_position,
  secondary_position = excluded.secondary_position,
  bats = excluded.bats,
  throws = excluded.throws,
  height = excluded.height,
  weight = excluded.weight,
  is_pitcher = excluded.is_pitcher,
  is_hitter = excluded.is_hitter,
  active = excluded.active,
  updated_at = now();

insert into public.player_team_memberships (
  player_id,
  team_id,
  season_id,
  roster_status,
  jersey_number,
  roster_role,
  active
)
values
  ('14a00000-0000-4000-8000-000000000001', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 2, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000002', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 4, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000003', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 7, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000004', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 9, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000005', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 12, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 15, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000007', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 18, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000008', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 21, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000009', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 24, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000010', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 27, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000011', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 32, 'Roster', true),
  ('14a00000-0000-4000-8000-000000000012', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Varsity', 44, 'Roster', true)
on conflict (player_id, team_id, season_id) do update
set
  roster_status = excluded.roster_status,
  jersey_number = excluded.jersey_number,
  roster_role = excluded.roster_role,
  active = excluded.active,
  updated_at = now();

insert into public.games (
  id,
  organization_id,
  team_id,
  season_id,
  opponent,
  starts_at,
  game_date,
  home_away,
  location,
  game_type,
  status,
  our_score,
  opponent_score,
  result
)
values
  ('14a90000-0000-4000-8000-000000000001', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Queen City Select', '2027-06-05 14:00:00-04', '2027-06-05', 'Home', 'Matthews Sportsplex', 'Showcase', 'completed', 6, 3, 'W'),
  ('14a90000-0000-4000-8000-000000000002', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Carolina Rockies 14U', '2027-06-12 16:30:00-04', '2027-06-12', 'Away', 'Rock Hill, SC', 'Tournament', 'completed', 4, 5, 'L'),
  ('14a90000-0000-4000-8000-000000000003', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'South Charlotte Stars', '2027-06-19 11:00:00-04', '2027-06-19', 'Home', 'Matthews Sportsplex', 'Tournament', 'completed', 8, 2, 'W'),
  ('14a90000-0000-4000-8000-000000000004', '8d7b9b66-5b46-4c84-82d3-3d61c3ad1006', '9a3b5d10-6e4f-4f7a-9b20-5d8f24ac2015', 'aa4c0b00-42ed-47fa-95af-7c8ed9ce3015', 'Pineville Post 80', '2027-06-26 10:00:00-04', '2027-06-26', 'Away', 'Pineville, NC', 'Showcase', 'scheduled', 0, 0, null)
on conflict (id) do update
set
  opponent = excluded.opponent,
  starts_at = excluded.starts_at,
  game_date = excluded.game_date,
  home_away = excluded.home_away,
  location = excluded.location,
  game_type = excluded.game_type,
  status = excluded.status,
  our_score = excluded.our_score,
  opponent_score = excluded.opponent_score,
  result = excluded.result,
  updated_at = now();

commit;
