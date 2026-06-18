-- Security hardening based on Supabase advisor recommendations.

-- 1. Public bucket already serves object URLs without RLS; a broad SELECT policy
--    only enables (unwanted) listing of all files. Drop it.
DROP POLICY IF EXISTS "media_read_public" ON storage.objects;

-- 2. Trigger functions must never be callable directly via the REST RPC surface.
--    Triggers still fire (they run under the table owner), so revoking EXECUTE
--    is safe and removes the "definer function executable" advisories.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_feed_comment() FROM PUBLIC, anon, authenticated;

-- 3. Membership helpers are referenced by RLS policies scoped to `authenticated`,
--    so authenticated must keep EXECUTE, but anon (via the default PUBLIC grant)
--    never needs them. Revoke the implicit PUBLIC grant, then grant authenticated.
REVOKE EXECUTE ON FUNCTION public.is_coach() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_enrolled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_coach() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled(uuid) TO authenticated;
