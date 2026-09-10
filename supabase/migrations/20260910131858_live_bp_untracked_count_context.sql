-- Keep concurrency state private to the round when count tracking is disabled.
-- Old clients remain compatible; the event/attribution transaction is unchanged.
do $$
declare
  definition text := pg_get_functiondef('public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb)'::regprocedure);
begin
  if position('payload->''context''->''before'' is distinct from r.state' in definition) = 0
    or position('state=payload->''context''->''after''' in definition) = 0 then
    raise exception 'Expected Live BP state guards were not found';
  end if;
  definition := replace(definition, 'payload->''context''->''before'' is distinct from r.state',
    'coalesce(payload->''stateBefore'', payload->''context''->''before'') is distinct from r.state');
  definition := replace(definition, 'state=payload->''context''->''after''',
    'state=coalesce(payload->''stateAfter'', payload->''context''->''after'')');
  execute definition;
end;
$$;
