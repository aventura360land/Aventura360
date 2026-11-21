-- Ejecutar en el SQL Editor de un proyecto dedicado a Xebax.
BEGIN;
CREATE TABLE IF NOT EXISTS public.xebax_moderators (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.xebax_moderators ADD COLUMN IF NOT EXISTS username text NOT NULL
  DEFAULT ('admin_' || replace(gen_random_uuid()::text,'-',''))
  CHECK (username ~ '^[a-z0-9_]{3,40}$');
CREATE UNIQUE INDEX IF NOT EXISTS xebax_moderators_username ON public.xebax_moderators (username);
CREATE TABLE IF NOT EXISTS public.xebax_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submission uuid NOT NULL UNIQUE,
  name text NOT NULL CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 60),
  stars smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(btrim(comment)) > 0 AND char_length(comment) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS xebax_reviews_status_id ON public.xebax_reviews(status,id DESC);
ALTER TABLE public.xebax_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xebax_moderators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xebax_moderators, public.xebax_reviews FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT(user_id,username) ON public.xebax_moderators TO authenticated;
GRANT SELECT(id,name,stars,comment,status,created_at),
      INSERT(submission,name,stars,comment) ON public.xebax_reviews TO anon,authenticated;
GRANT UPDATE(status) ON public.xebax_reviews TO authenticated;

DROP POLICY IF EXISTS xebax_mod_self ON public.xebax_moderators;
CREATE POLICY xebax_mod_self ON public.xebax_moderators FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS xebax_public_read ON public.xebax_reviews;
CREATE POLICY xebax_public_read ON public.xebax_reviews FOR SELECT TO anon,authenticated
  USING (status='published');
DROP POLICY IF EXISTS xebax_submit ON public.xebax_reviews;
CREATE POLICY xebax_submit ON public.xebax_reviews FOR INSERT TO anon,authenticated
  WITH CHECK (status='pending');
DROP POLICY IF EXISTS xebax_mod_read ON public.xebax_reviews;
CREATE POLICY xebax_mod_read ON public.xebax_reviews FOR SELECT TO authenticated
  USING ((SELECT EXISTS(SELECT 1 FROM public.xebax_moderators WHERE user_id=(SELECT auth.uid()))));
DROP POLICY IF EXISTS xebax_moderate ON public.xebax_reviews;
CREATE POLICY xebax_moderate ON public.xebax_reviews FOR UPDATE TO authenticated
  USING ((SELECT EXISTS(SELECT 1 FROM public.xebax_moderators WHERE user_id=(SELECT auth.uid()))))
  WITH CHECK (status IN ('published','hidden') AND
    (SELECT EXISTS(SELECT 1 FROM public.xebax_moderators WHERE user_id=(SELECT auth.uid()))));

CREATE OR REPLACE FUNCTION public.xebax_review_summary()
RETURNS TABLE(total bigint,average numeric) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT count(*), round(avg(stars),1) FROM public.xebax_reviews WHERE status='published' $$;
REVOKE ALL ON FUNCTION public.xebax_review_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xebax_review_summary() TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
