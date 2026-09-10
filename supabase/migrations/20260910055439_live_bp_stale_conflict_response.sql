-- A stale client version is permanent for that request, not a retryable
-- serialization failure. Preserve the deployed function body and privileges.
do $$
declare
  definition text := pg_get_functiondef('public.write_live_bp(uuid,uuid,uuid,text,integer,uuid,jsonb)'::regprocedure);
begin
  if position('errcode=''40001''' in definition) = 0 then
    raise exception 'Expected Live BP conflict guards were not found';
  end if;
  execute replace(definition, 'errcode=''40001''', 'errcode=''PT409''');
end;
$$;
