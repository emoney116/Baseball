-- Profile photos are stored on application profile/staff rows, not auth metadata.
-- Supabase embeds auth user_metadata in JWT/session cookies; large avatar data
-- URLs there can exceed Vercel's request-header limit before the app renders.

update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'avatar_url',
    updated_at = now()
where raw_user_meta_data ? 'avatar_url';

