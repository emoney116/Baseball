-- Keep the previous staff invitation RPC signature available while the
-- organization-management flow uses the org-role-aware signature.
create or replace function public.create_staff_invitation(
  invite_email text,
  invite_first_name text,
  invite_last_name text,
  invite_staff_role text,
  invite_access_role text,
  invite_token_hash text,
  invite_expires_at timestamptz,
  invite_team_ids uuid[],
  invite_season_ids uuid[] default array[]::uuid[]
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.create_staff_invitation(
    invite_email,
    invite_first_name,
    invite_last_name,
    invite_staff_role,
    invite_access_role,
    invite_token_hash,
    invite_expires_at,
    invite_team_ids,
    invite_season_ids,
    'MEMBER'
  );
$$;

revoke all on function public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[]) from public;
grant execute on function public.create_staff_invitation(text, text, text, text, text, text, timestamptz, uuid[], uuid[]) to authenticated;
