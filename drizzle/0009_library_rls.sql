-- RLS + storage for the research library.
--
-- Reads are open to any authenticated user; writes (ingestion/curation) are
-- coach-only. The ingestion pipeline uses the service-role client, which bypasses
-- RLS entirely, so these policies only gate the in-app (JWT) surface.
-- Coach detection reuses public.is_coach() defined in 0001_security.sql.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every new table
-- ---------------------------------------------------------------------------
ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_threads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insight_rules     ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. library_documents: all authenticated read; coach writes
-- ---------------------------------------------------------------------------
CREATE POLICY "library_documents_select_auth" ON public.library_documents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "library_documents_coach_write" ON public.library_documents
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- 3. document_chunks: all authenticated read; coach writes
-- ---------------------------------------------------------------------------
CREATE POLICY "document_chunks_select_auth" ON public.document_chunks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "document_chunks_coach_write" ON public.document_chunks
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- 4. library_threads: owner only
-- ---------------------------------------------------------------------------
CREATE POLICY "library_threads_select" ON public.library_threads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "library_threads_insert" ON public.library_threads
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "library_threads_update" ON public.library_threads
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "library_threads_delete" ON public.library_threads
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. library_messages: scoped through the owning thread
-- ---------------------------------------------------------------------------
CREATE POLICY "library_messages_select" ON public.library_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.library_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "library_messages_insert" ON public.library_messages
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.library_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "library_messages_update" ON public.library_messages
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.library_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.library_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "library_messages_delete" ON public.library_messages
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.library_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6. insight_rules: all authenticated read; coach writes
-- ---------------------------------------------------------------------------
CREATE POLICY "insight_rules_select_auth" ON public.insight_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insight_rules_coach_write" ON public.insight_rules
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- ---------------------------------------------------------------------------
-- 7. Private `library` storage bucket + object policies
--    (mirrors the `media` bucket setup in 0001, but private and coach-gated for
--    writes; reads happen via server-side signed URLs but authenticated users
--    are allowed to SELECT object rows.)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('library', 'library', false)
ON CONFLICT (id) DO NOTHING;

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
