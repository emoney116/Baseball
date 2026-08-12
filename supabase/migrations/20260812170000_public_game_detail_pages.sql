begin;

create table if not exists public.public_game_details (
  game_id uuid primary key references public.games(id) on delete cascade,
  team_record text,
  opponent_record text,
  event_name text,
  venue text,
  field_label text,
  city text,
  state text,
  public_notes text,
  comparison jsonb not null default '{"metrics":[]}'::jsonb,
  probable_starters jsonb not null default '{}'::jsonb,
  recent_matchup jsonb,
  linescore jsonb not null default '[]'::jsonb,
  team_totals jsonb not null default '{"rows":[]}'::jsonb,
  play_by_play jsonb not null default '[]'::jsonb,
  box_score jsonb not null default '{"batting":[],"pitching":[]}'::jsonb,
  highlights jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.public_game_details enable row level security;

drop policy if exists clubhouse_public_game_details_staff on public.public_game_details;
create policy clubhouse_public_game_details_staff on public.public_game_details
  for all to authenticated
  using (public.is_game_staff(game_id))
  with check (public.is_game_staff(game_id));

grant select, insert, update, delete on public.public_game_details to authenticated;

insert into public.public_game_details (
  game_id,
  team_record,
  opponent_record,
  event_name,
  venue,
  field_label,
  city,
  state,
  public_notes,
  comparison,
  probable_starters,
  recent_matchup,
  linescore,
  team_totals,
  play_by_play,
  box_score,
  highlights
)
values
  (
    '14a90000-0000-4000-8000-000000000004',
    '2-1',
    '9-6',
    'Showcase',
    'Pineville Park',
    'Field 2',
    'Pineville',
    'NC',
    'Showcase pool play matchup.',
    $json${
      "teamLabel": "CS 14U",
      "opponentLabel": "PP 80",
      "metrics": [
        {"label":"Team AVG","team":".318","opponent":".286"},
        {"label":"Team OBP","team":".407","opponent":".352"},
        {"label":"Team SLG","team":".451","opponent":".398"},
        {"label":"Runs Scored","team":"18","opponent":"15"},
        {"label":"Runs Allowed","team":"10","opponent":"13"},
        {"label":"Record","team":"2-1","opponent":"9-6"}
      ]
    }$json$::jsonb,
    $json${
      "team":{"name":"Jackson Reed","number":"12","role":"RHP","line":"2-0, 2.45 ERA, 18 K"},
      "opponent":{"name":"Ethan Carter","number":"11","role":"RHP","line":"2-3, 3.45 ERA, 18 K"}
    }$json$::jsonb,
    $json${"date":"Jun 5","teamScore":6,"opponentScore":3,"opponent":"Queen City Select"}$json$::jsonb,
    '[]'::jsonb,
    '{"rows":[]}'::jsonb,
    '[]'::jsonb,
    '{"batting":[],"pitching":[]}'::jsonb,
    '[]'::jsonb
  ),
  (
    '14a90000-0000-4000-8000-000000000003',
    '2-1',
    '6-4',
    'Tournament',
    'Matthews Sportsplex',
    'Field 4',
    'Matthews',
    'NC',
    'Final score and public box score from pool play.',
    $json${
      "teamLabel": "CS 14U",
      "opponentLabel": "SC Stars",
      "metrics": [
        {"label":"Runs","team":"8","opponent":"2"},
        {"label":"Hits","team":"10","opponent":"5"},
        {"label":"Errors","team":"1","opponent":"2"},
        {"label":"Walks","team":"5","opponent":"2"},
        {"label":"Strikeouts","team":"4","opponent":"8"},
        {"label":"LOB","team":"6","opponent":"5"}
      ]
    }$json$::jsonb,
    '{}'::jsonb,
    null,
    $json$[
      {"team":"Carolina Showcase 14U","innings":[1,0,2,1,3,1,0],"runs":8,"hits":10,"errors":1},
      {"team":"South Charlotte Stars","innings":[0,1,0,0,0,1,0],"runs":2,"hits":5,"errors":2}
    ]$json$::jsonb,
    $json${
      "winningPitcher":"Jackson Reed (1-0)",
      "losingPitcher":"Owen Clark (0-1)",
      "save":"",
      "rows":[
        {"team":"Carolina Showcase 14U","hits":"10","errors":"1","walks":"5","strikeouts":"4","lob":"6"},
        {"team":"South Charlotte Stars","hits":"5","errors":"2","walks":"2","strikeouts":"8","lob":"5"}
      ]
    }$json$::jsonb,
    $json$[
      {"label":"Top 1st","events":[{"text":"Carson Hill singles to center and scores on Nolan Price's groundout.","score":"Carolina Showcase 1, South Charlotte Stars 0"}]},
      {"label":"Bottom 2nd","events":[{"text":"South Charlotte ties the game on a two-out RBI single.","score":"Carolina Showcase 1, South Charlotte Stars 1"}]},
      {"label":"Top 3rd","events":[{"text":"Liam Brooks doubles to left, scoring Mateo Alvarez and Carson Hill.","score":"Carolina Showcase 3, South Charlotte Stars 1"}]},
      {"label":"Top 5th","events":[{"text":"Jackson Reed drives in two with a line-drive single.","score":"Carolina Showcase 7, South Charlotte Stars 1"}]},
      {"label":"Bottom 6th","events":[{"text":"South Charlotte adds one run before Caleb Foster ends the inning with a strikeout.","score":"Carolina Showcase 8, South Charlotte Stars 2"}]}
    ]$json$::jsonb,
    $json${
      "batting":[
        {"team":"Carolina Showcase 14U","rows":[
          {"player":"Carson Hill","ab":4,"r":2,"h":2,"rbi":1,"bb":1,"so":0,"extra":"2B"},
          {"player":"Liam Brooks","ab":4,"r":1,"h":2,"rbi":2,"bb":0,"so":1,"extra":"2B"},
          {"player":"Jackson Reed","ab":3,"r":1,"h":2,"rbi":2,"bb":1,"so":0,"extra":""},
          {"player":"Nolan Price","ab":4,"r":0,"h":1,"rbi":1,"bb":0,"so":1,"extra":""},
          {"player":"Mason Grant","ab":3,"r":1,"h":1,"rbi":1,"bb":1,"so":1,"extra":""}
        ]},
        {"team":"South Charlotte Stars","rows":[
          {"player":"Team Totals","ab":27,"r":2,"h":5,"rbi":2,"bb":2,"so":8,"extra":""}
        ]}
      ],
      "pitching":[
        {"team":"Carolina Showcase 14U","rows":[
          {"player":"Jackson Reed","ip":"5.0","h":3,"r":1,"er":1,"bb":1,"so":7,"pitches":"71"},
          {"player":"Caleb Foster","ip":"2.0","h":2,"r":1,"er":0,"bb":1,"so":1,"pitches":"28"}
        ]},
        {"team":"South Charlotte Stars","rows":[
          {"player":"Team Pitching","ip":"7.0","h":10,"r":8,"er":6,"bb":5,"so":4,"pitches":"119"}
        ]}
      ]
    }$json$::jsonb,
    $json$[
      {"name":"Jackson Reed","line":"5.0 IP, 3 H, 1 ER, 7 K"},
      {"name":"Liam Brooks","line":"2-4, 2B, 2 RBI"},
      {"name":"Carson Hill","line":"2-4, 2 R, RBI"}
    ]$json$::jsonb
  ),
  (
    '14a90000-0000-4000-8000-000000000002',
    '1-1',
    '4-2',
    'Tournament',
    'Rock Hill Complex',
    'Field 3',
    'Rock Hill',
    'SC',
    'One-run tournament result.',
    $json${
      "teamLabel": "CS 14U",
      "opponentLabel": "Rockies",
      "metrics": [
        {"label":"Runs","team":"4","opponent":"5"},
        {"label":"Hits","team":"7","opponent":"8"},
        {"label":"Errors","team":"2","opponent":"1"},
        {"label":"Walks","team":"3","opponent":"4"},
        {"label":"Strikeouts","team":"7","opponent":"6"},
        {"label":"LOB","team":"7","opponent":"6"}
      ]
    }$json$::jsonb,
    '{}'::jsonb,
    null,
    $json$[
      {"team":"Carolina Showcase 14U","innings":[0,1,0,2,0,1,0],"runs":4,"hits":7,"errors":2},
      {"team":"Carolina Rockies 14U","innings":[1,0,0,1,2,1,0],"runs":5,"hits":8,"errors":1}
    ]$json$::jsonb,
    $json${
      "winningPitcher":"Team Pitching",
      "losingPitcher":"Liam Brooks (0-1)",
      "save":"",
      "rows":[
        {"team":"Carolina Showcase 14U","hits":"7","errors":"2","walks":"3","strikeouts":"7","lob":"7"},
        {"team":"Carolina Rockies 14U","hits":"8","errors":"1","walks":"4","strikeouts":"6","lob":"6"}
      ]
    }$json$::jsonb,
    $json$[
      {"label":"Top 2nd","events":[{"text":"Mason Grant scores on a two-out single by Ben Walker.","score":"Carolina Showcase 1, Carolina Rockies 1"}]},
      {"label":"Top 4th","events":[{"text":"Nolan Price doubles home two runs.","score":"Carolina Showcase 3, Carolina Rockies 2"}]},
      {"label":"Bottom 5th","events":[{"text":"Carolina Rockies take the lead on a sacrifice fly and RBI single.","score":"Carolina Rockies 4, Carolina Showcase 3"}]},
      {"label":"Top 6th","events":[{"text":"Owen Parker ties it with a groundout.","score":"Carolina Showcase 4, Carolina Rockies 4"}]},
      {"label":"Bottom 6th","events":[{"text":"Rockies answer with the final run on a two-out hit.","score":"Carolina Rockies 5, Carolina Showcase 4"}]}
    ]$json$::jsonb,
    $json${
      "batting":[
        {"team":"Carolina Showcase 14U","rows":[
          {"player":"Nolan Price","ab":3,"r":0,"h":2,"rbi":2,"bb":1,"so":0,"extra":"2B"},
          {"player":"Ben Walker","ab":3,"r":0,"h":1,"rbi":1,"bb":0,"so":1,"extra":""},
          {"player":"Owen Parker","ab":4,"r":0,"h":1,"rbi":1,"bb":0,"so":1,"extra":""}
        ]},
        {"team":"Carolina Rockies 14U","rows":[
          {"player":"Team Totals","ab":28,"r":5,"h":8,"rbi":5,"bb":4,"so":6,"extra":"2B"}
        ]}
      ],
      "pitching":[
        {"team":"Carolina Showcase 14U","rows":[
          {"player":"Liam Brooks","ip":"4.2","h":6,"r":4,"er":3,"bb":3,"so":5,"pitches":"78"},
          {"player":"Tyler Scott","ip":"1.1","h":2,"r":1,"er":1,"bb":1,"so":1,"pitches":"24"}
        ]},
        {"team":"Carolina Rockies 14U","rows":[
          {"player":"Team Pitching","ip":"7.0","h":7,"r":4,"er":4,"bb":3,"so":7,"pitches":"104"}
        ]}
      ]
    }$json$::jsonb,
    $json$[
      {"name":"Nolan Price","line":"2-3, 2B, 2 RBI"},
      {"name":"Liam Brooks","line":"4.2 IP, 5 K"},
      {"name":"Owen Parker","line":"RBI groundout"}
    ]$json$::jsonb
  ),
  (
    '14a90000-0000-4000-8000-000000000001',
    '1-0',
    '0-1',
    'Showcase',
    'Matthews Sportsplex',
    'Field 1',
    'Matthews',
    'NC',
    'Opening showcase win.',
    $json${
      "teamLabel": "CS 14U",
      "opponentLabel": "Queen City",
      "metrics": [
        {"label":"Runs","team":"6","opponent":"3"},
        {"label":"Hits","team":"8","opponent":"6"},
        {"label":"Errors","team":"1","opponent":"2"},
        {"label":"Walks","team":"4","opponent":"2"},
        {"label":"Strikeouts","team":"5","opponent":"7"},
        {"label":"LOB","team":"5","opponent":"6"}
      ]
    }$json$::jsonb,
    '{}'::jsonb,
    null,
    $json$[
      {"team":"Carolina Showcase 14U","innings":[0,2,0,1,0,3,0],"runs":6,"hits":8,"errors":1},
      {"team":"Queen City Select","innings":[1,0,0,0,2,0,0],"runs":3,"hits":6,"errors":2}
    ]$json$::jsonb,
    $json${
      "winningPitcher":"Jackson Reed (1-0)",
      "losingPitcher":"Team Pitching",
      "save":"Caleb Foster (1)",
      "rows":[
        {"team":"Carolina Showcase 14U","hits":"8","errors":"1","walks":"4","strikeouts":"5","lob":"5"},
        {"team":"Queen City Select","hits":"6","errors":"2","walks":"2","strikeouts":"7","lob":"6"}
      ]
    }$json$::jsonb,
    $json$[
      {"label":"Bottom 1st","events":[{"text":"Queen City scores first on an RBI double.","score":"Queen City Select 1, Carolina Showcase 0"}]},
      {"label":"Top 2nd","events":[{"text":"Mason Grant singles and Owen Parker follows with a two-run double.","score":"Carolina Showcase 2, Queen City Select 1"}]},
      {"label":"Top 4th","events":[{"text":"Caleb Foster scores on a passed ball.","score":"Carolina Showcase 3, Queen City Select 1"}]},
      {"label":"Bottom 5th","events":[{"text":"Queen City ties the game with two runs.","score":"Carolina Showcase 3, Queen City Select 3"}]},
      {"label":"Top 6th","events":[{"text":"Carson Hill clears the bases with a two-out double.","score":"Carolina Showcase 6, Queen City Select 3"}]}
    ]$json$::jsonb,
    $json${
      "batting":[
        {"team":"Carolina Showcase 14U","rows":[
          {"player":"Carson Hill","ab":4,"r":1,"h":2,"rbi":3,"bb":0,"so":1,"extra":"2B"},
          {"player":"Owen Parker","ab":3,"r":0,"h":1,"rbi":2,"bb":1,"so":0,"extra":"2B"},
          {"player":"Mason Grant","ab":3,"r":2,"h":2,"rbi":0,"bb":1,"so":0,"extra":""}
        ]},
        {"team":"Queen City Select","rows":[
          {"player":"Team Totals","ab":27,"r":3,"h":6,"rbi":3,"bb":2,"so":7,"extra":"2B"}
        ]}
      ],
      "pitching":[
        {"team":"Carolina Showcase 14U","rows":[
          {"player":"Jackson Reed","ip":"5.0","h":5,"r":3,"er":2,"bb":2,"so":5,"pitches":"74"},
          {"player":"Caleb Foster","ip":"2.0","h":1,"r":0,"er":0,"bb":0,"so":2,"pitches":"25"}
        ]},
        {"team":"Queen City Select","rows":[
          {"player":"Team Pitching","ip":"7.0","h":8,"r":6,"er":4,"bb":4,"so":5,"pitches":"111"}
        ]}
      ]
    }$json$::jsonb,
    $json$[
      {"name":"Carson Hill","line":"2-4, 2B, 3 RBI"},
      {"name":"Jackson Reed","line":"5.0 IP, 5 K"},
      {"name":"Caleb Foster","line":"2.0 IP, SV"}
    ]$json$::jsonb
  )
on conflict (game_id) do update
set
  team_record = excluded.team_record,
  opponent_record = excluded.opponent_record,
  event_name = excluded.event_name,
  venue = excluded.venue,
  field_label = excluded.field_label,
  city = excluded.city,
  state = excluded.state,
  public_notes = excluded.public_notes,
  comparison = excluded.comparison,
  probable_starters = excluded.probable_starters,
  recent_matchup = excluded.recent_matchup,
  linescore = excluded.linescore,
  team_totals = excluded.team_totals,
  play_by_play = excluded.play_by_play,
  box_score = excluded.box_score,
  highlights = excluded.highlights,
  updated_at = now();

commit;
