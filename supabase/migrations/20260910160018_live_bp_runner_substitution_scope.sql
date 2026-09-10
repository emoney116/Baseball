-- Validate the incoming runner roster after a pinch-runner substitution.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb)'::regprocedure);
  if position('else r.state->''runnerIds'' end' in definition)=0 then raise exception 'Expected runner scope guard missing'; end if;
  definition := replace(definition, 'else r.state->''runnerIds'' end', 'when operation=''runner'' then payload->''stateAfter''->''runnerIds'' else r.state->''runnerIds'' end');
  execute definition;
end; $$;
