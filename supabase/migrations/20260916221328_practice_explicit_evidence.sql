-- Explicit coach evidence can exceed prompting defaults. Preserve the existing
-- service-only transaction, authorization, roster scope, revision and undo guards.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb)'::regprocedure);
  if position('s->>''defense''=''OFF'' or h.action' in definition)=0
    or position('(s->>''defense''=''SELECTED'' and not s->''positions'' ? de.position_worked)' in definition)=0 then
    raise exception 'Expected Live BP defense guards were not found';
  end if;
  definition := replace(definition,
    's->>''defense''=''OFF'' or h.action',
    '(s->>''defense''=''OFF'' and payload->''context''->''explicitDefense'' is distinct from ''true''::jsonb) or h.action');
  definition := replace(definition,
    '(s->>''defense''=''SELECTED'' and not s->''positions'' ? de.position_worked)',
    '(s->>''defense''=''SELECTED'' and not s->''positions'' ? de.position_worked and payload->''context''->''explicitDefense'' is distinct from ''true''::jsonb) or de.result is null or de.result not in (''Clean'',''Missed Rep'',''Error'',''Great Play'')');
  execute definition;
end;
$migration$;
