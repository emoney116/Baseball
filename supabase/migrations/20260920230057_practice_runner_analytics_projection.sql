-- Read-only projection: never expose actor, raw round state, or unrelated actions.
create function clubhouse_private.practice_runner_actions(practice_ids uuid[])
returns table(id uuid, practice_id uuid, round_id uuid, version integer, created_at timestamptz, movement jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or cardinality(practice_ids)>100 then
    raise exception 'Authorized bounded Practice scope required.' using errcode='42501';
  end if;
  if exists (select 1 from unnest(practice_ids) requested(id)
    left join public.practices p on p.id=requested.id
    where p.id is null or not public.current_profile_can_manage_team(p.team_id)) then
    raise exception 'Practice unavailable.' using errcode='42501';
  end if;
  return query select a.id,r.practice_id,a.round_id,a.version,a.created_at,
    jsonb_build_object('from',a.detail->'from','to',a.detail->'to',
      'outcome',coalesce(a.detail->'outcome','"safe"'::jsonb),
      'reason',a.detail->'reason','runnerId',coalesce(nullif(a.detail->'runnerId','null'),a.before_state->'runnerIds'->(a.detail->>'from')),
      'pitchId',a.detail->'pitchId','source',a.detail->'source')
    from clubhouse_private.live_bp_actions a join public.live_bp_rounds r on r.id=a.round_id
    where r.practice_id=any(practice_ids) and a.kind='runner' and not a.undone;
end; $$;
revoke all on function clubhouse_private.practice_runner_actions(uuid[]) from public,anon;
grant execute on function clubhouse_private.practice_runner_actions(uuid[]) to authenticated;

create function public.read_practice_runner_actions(practice_ids uuid[])
returns table(id uuid, practice_id uuid, round_id uuid, version integer, created_at timestamptz, movement jsonb)
language sql stable security invoker set search_path='' as $$
  select * from clubhouse_private.practice_runner_actions(practice_ids);
$$;
revoke all on function public.read_practice_runner_actions(uuid[]) from public,anon;
grant execute on function public.read_practice_runner_actions(uuid[]) to authenticated;
