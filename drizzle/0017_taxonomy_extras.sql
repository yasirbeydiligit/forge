-- Taxonomy extras (hand-authored; companion to the generated 0016) requested
-- after the coach refined the exercise CSV with finer anatomy. Adds the
-- brachioradialis muscle and three additional muscle functions. Idempotent on
-- slug. No table-structure changes, so the Drizzle snapshot is unchanged from 0016.

INSERT INTO public.muscles (slug, name_tr, name_latin, region) VALUES
  ('brachioradialis', 'Brakiyoradiyalis', 'Brachioradialis', 'upper')
ON CONFLICT (slug) DO UPDATE
  SET name_tr = EXCLUDED.name_tr,
      name_latin = EXCLUDED.name_latin,
      region = EXCLUDED.region;

INSERT INTO public.muscle_functions (muscle_id, slug, name_tr, name_technical)
SELECT m.id, v.slug, v.name_tr, v.name_technical
FROM (VALUES
  ('brachioradialis', 'brachioradialis-elbow-flexion', 'Dirsek fleksiyonu (nötr kavrama)', 'Elbow flexion (neutral grip)'),
  ('biceps',          'biceps-brachii-elbow-flexion',  'Dirsek fleksiyonu (biceps brachii)', 'Elbow flexion (biceps brachii)'),
  ('traps-mid',       'traps-scapular-retraction',     'Skapula retraksiyonu',               'Scapular retraction')
) AS v(muscle_slug, slug, name_tr, name_technical)
JOIN public.muscles m ON m.slug = v.muscle_slug
ON CONFLICT (slug) DO UPDATE
  SET name_tr = EXCLUDED.name_tr,
      name_technical = EXCLUDED.name_technical;
