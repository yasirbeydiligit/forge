-- RLS + storage for profile_details, physique_photos, cardio_sessions.
-- profile_details / cardio_sessions: athlete owns the rows, coach is read-only
-- (mirrors daily_metrics 0004). physique_photos are SENSITIVE — visible to the
-- owner and the coach only; the backing storage bucket is private and every
-- object path starts with the owner's uid, enforced by the object policies.

-- 1. Username format guard (the unique constraint comes from 0025).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

-- 2. profile_details: owner full CRUD, coach read-only.
ALTER TABLE public.profile_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_details_select" ON public.profile_details;
CREATE POLICY "profile_details_select" ON public.profile_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_coach());
DROP POLICY IF EXISTS "profile_details_insert" ON public.profile_details;
CREATE POLICY "profile_details_insert" ON public.profile_details
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "profile_details_update" ON public.profile_details;
CREATE POLICY "profile_details_update" ON public.profile_details
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "profile_details_delete" ON public.profile_details;
CREATE POLICY "profile_details_delete" ON public.profile_details
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. physique_photos rows: owner full CRUD, coach read-only.
ALTER TABLE public.physique_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "physique_photos_select" ON public.physique_photos;
CREATE POLICY "physique_photos_select" ON public.physique_photos
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
DROP POLICY IF EXISTS "physique_photos_insert" ON public.physique_photos;
CREATE POLICY "physique_photos_insert" ON public.physique_photos
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
DROP POLICY IF EXISTS "physique_photos_update" ON public.physique_photos;
CREATE POLICY "physique_photos_update" ON public.physique_photos
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
DROP POLICY IF EXISTS "physique_photos_delete" ON public.physique_photos;
CREATE POLICY "physique_photos_delete" ON public.physique_photos
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());

-- 4. cardio_sessions: owner full CRUD, coach read-only.
ALTER TABLE public.cardio_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cardio_sessions_select" ON public.cardio_sessions;
CREATE POLICY "cardio_sessions_select" ON public.cardio_sessions
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
DROP POLICY IF EXISTS "cardio_sessions_insert" ON public.cardio_sessions;
CREATE POLICY "cardio_sessions_insert" ON public.cardio_sessions
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
DROP POLICY IF EXISTS "cardio_sessions_update" ON public.cardio_sessions;
CREATE POLICY "cardio_sessions_update" ON public.cardio_sessions
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
DROP POLICY IF EXISTS "cardio_sessions_delete" ON public.cardio_sessions;
CREATE POLICY "cardio_sessions_delete" ON public.cardio_sessions
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());

-- 5. Private storage bucket for physique photos. iOS converts HEIC to JPEG on
-- web upload, so the browser-displayable trio is enough.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('physique', 'physique', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 6. Object policies: writes only inside your own top-level folder; reads for
-- the owner folder or the coach. No UPDATE policy — objects are immutable
-- (replace = delete + upload). Signed URLs are minted with the user's JWT, so
-- this SELECT policy is what gates them.
DROP POLICY IF EXISTS "physique_insert_own" ON storage.objects;
CREATE POLICY "physique_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'physique'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "physique_select_own_or_coach" ON storage.objects;
CREATE POLICY "physique_select_own_or_coach" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'physique'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_coach())
  );

DROP POLICY IF EXISTS "physique_delete_own" ON storage.objects;
CREATE POLICY "physique_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'physique'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
