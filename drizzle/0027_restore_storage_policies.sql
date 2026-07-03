-- Repair: restore storage.objects policies lost in the 2026-06-27 region
-- migration (Tokyo → Frankfurt). The pg_dump/psql copy silently skipped
-- policies on the storage schema, so `media` uploads (avatars, feed images)
-- and `library` uploads (coach PDFs) failed with 42501 for every user.
-- The physique_* policies (0026) were created directly on Frankfurt and
-- survived; this file re-creates the media_* set from 0001 (minus
-- media_read_public, deliberately dropped in 0002 — the public bucket serves
-- object URLs without RLS and a broad SELECT only enables listing) and the
-- library_* set from 0009. Idempotent.

DROP POLICY IF EXISTS "media_insert_auth" ON storage.objects;
CREATE POLICY "media_insert_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "media_update_own" ON storage.objects;
CREATE POLICY "media_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "media_delete_own" ON storage.objects;
CREATE POLICY "media_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "library_read_auth" ON storage.objects;
CREATE POLICY "library_read_auth" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'library');

DROP POLICY IF EXISTS "library_insert_coach" ON storage.objects;
CREATE POLICY "library_insert_coach" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'library' AND public.is_coach());

DROP POLICY IF EXISTS "library_update_coach" ON storage.objects;
CREATE POLICY "library_update_coach" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'library' AND public.is_coach());

DROP POLICY IF EXISTS "library_delete_coach" ON storage.objects;
CREATE POLICY "library_delete_coach" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'library' AND public.is_coach());
