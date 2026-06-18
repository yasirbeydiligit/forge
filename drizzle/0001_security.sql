-- Security layer: auth linkage, helper functions, triggers, RLS policies, storage.
-- This migration is the authoritative access-control definition for the app.

-- ---------------------------------------------------------------------------
-- 1. Link profiles to auth.users
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."profiles"
  DROP CONSTRAINT IF EXISTS "profiles_id_fkey";
ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Role grants (RLS still gates every row; grants only enable evaluation)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA "public" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "public" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "public" TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA "public" TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA "public"
  GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER so they bypass RLS for membership checks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'coach'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_enrolled(p_program uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.program_id = p_program AND e.athlete_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Auto-create a profile when a new auth user is created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'athlete'),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. Mark a question answered when a coach comments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_feed_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.author_id AND p.role = 'coach'
  ) THEN
    UPDATE public.feed_posts
       SET answered = true,
           answered_by = NEW.author_id,
           answered_at = COALESCE(answered_at, now())
     WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_feed_comment_created ON public.feed_comments;
CREATE TRIGGER on_feed_comment_created
  AFTER INSERT ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.handle_feed_comment();

-- ---------------------------------------------------------------------------
-- 6. Enable RLS on every table
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_sets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_comments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_likes           ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 7. Policies
-- ---------------------------------------------------------------------------

-- profiles: everyone in the community can read; users edit their own, coach edits all
CREATE POLICY "profiles_select_auth" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_self_or_coach" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_coach())
  WITH CHECK (id = auth.uid() OR public.is_coach());
CREATE POLICY "profiles_delete_coach" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_coach());

-- invites: coach only (signup validates tokens server-side via service role)
CREATE POLICY "invites_coach_all" ON public.invites
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- exercises: readable by all; mutated by coach
CREATE POLICY "exercises_select_auth" ON public.exercises
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "exercises_coach_write" ON public.exercises
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- programs: coach sees all, athletes see published; mutated by coach
CREATE POLICY "programs_select" ON public.programs
  FOR SELECT TO authenticated USING (public.is_coach() OR is_published);
CREATE POLICY "programs_coach_write" ON public.programs
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- workouts & workout_exercises: readable by all; mutated by coach
CREATE POLICY "workouts_select_auth" ON public.workouts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "workouts_coach_write" ON public.workouts
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

CREATE POLICY "workout_exercises_select_auth" ON public.workout_exercises
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "workout_exercises_coach_write" ON public.workout_exercises
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- enrollments: coach sees all, athletes their own; athletes enroll themselves
CREATE POLICY "enrollments_select" ON public.enrollments
  FOR SELECT TO authenticated USING (public.is_coach() OR athlete_id = auth.uid());
CREATE POLICY "enrollments_insert" ON public.enrollments
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "enrollments_update" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach())
  WITH CHECK (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "enrollments_delete" ON public.enrollments
  FOR DELETE TO authenticated USING (athlete_id = auth.uid() OR public.is_coach());

-- calendar assignments: coach all; athletes see program-wide (if enrolled) or personal
CREATE POLICY "calendar_select" ON public.calendar_assignments
  FOR SELECT TO authenticated USING (
    public.is_coach()
    OR athlete_id = auth.uid()
    OR (athlete_id IS NULL AND public.is_enrolled(program_id))
  );
CREATE POLICY "calendar_coach_write" ON public.calendar_assignments
  FOR ALL TO authenticated USING (public.is_coach()) WITH CHECK (public.is_coach());

-- log sessions: athlete owns their data; coach read-only
CREATE POLICY "log_sessions_select" ON public.log_sessions
  FOR SELECT TO authenticated USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "log_sessions_insert" ON public.log_sessions
  FOR INSERT TO authenticated WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "log_sessions_update" ON public.log_sessions
  FOR UPDATE TO authenticated USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY "log_sessions_delete" ON public.log_sessions
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());

-- log sets: scoped through the owning session
CREATE POLICY "log_sets_select" ON public.log_sets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.log_sessions s
      WHERE s.id = session_id AND (s.athlete_id = auth.uid() OR public.is_coach())
    )
  );
CREATE POLICY "log_sets_insert" ON public.log_sets
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.log_sessions s
      WHERE s.id = session_id AND s.athlete_id = auth.uid()
    )
  );
CREATE POLICY "log_sets_update" ON public.log_sets
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.log_sessions s
      WHERE s.id = session_id AND s.athlete_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.log_sessions s
      WHERE s.id = session_id AND s.athlete_id = auth.uid()
    )
  );
CREATE POLICY "log_sets_delete" ON public.log_sets
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.log_sessions s
      WHERE s.id = session_id AND s.athlete_id = auth.uid()
    )
  );

-- feed posts: community-readable; author/coach manage
CREATE POLICY "feed_posts_select_auth" ON public.feed_posts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_posts_insert" ON public.feed_posts
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "feed_posts_update" ON public.feed_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_coach())
  WITH CHECK (author_id = auth.uid() OR public.is_coach());
CREATE POLICY "feed_posts_delete" ON public.feed_posts
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_coach());

-- feed comments: community-readable; author/coach manage
CREATE POLICY "feed_comments_select_auth" ON public.feed_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_comments_insert" ON public.feed_comments
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "feed_comments_update" ON public.feed_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_coach())
  WITH CHECK (author_id = auth.uid() OR public.is_coach());
CREATE POLICY "feed_comments_delete" ON public.feed_comments
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_coach());

-- feed likes: community-readable; each user manages their own like
CREATE POLICY "feed_likes_select_auth" ON public.feed_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "feed_likes_insert" ON public.feed_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "feed_likes_delete" ON public.feed_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 8. Storage bucket for profile / feed / cover images
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "media_read_public" ON storage.objects;
CREATE POLICY "media_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media_insert_auth" ON storage.objects;
CREATE POLICY "media_insert_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "media_update_own" ON storage.objects;
CREATE POLICY "media_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'media' AND owner = auth.uid());

DROP POLICY IF EXISTS "media_delete_own" ON storage.objects;
CREATE POLICY "media_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'media' AND owner = auth.uid());
