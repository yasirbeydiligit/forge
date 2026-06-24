-- Reference data: muscles + muscle_functions (hand-authored; companion to 0013).
-- This is the stable backbone the exercise CSV import references by slug, so it
-- ships as a migration (present in every environment). Idempotent: ON CONFLICT
-- on the slug updates names in place. No table-structure changes here, so the
-- Drizzle snapshot is unchanged from 0014.

-- ---------------------------------------------------------------------------
-- 1. Muscles (Turkish display name + Latin/technical name + region)
-- ---------------------------------------------------------------------------
INSERT INTO public.muscles (slug, name_tr, name_latin, region) VALUES
  ('chest',           'Göğüs (büyük)',          'Pectoralis major',              'upper'),
  ('lat',             'Sırt kanat (Lat)',       'Latissimus dorsi',              'upper'),
  ('traps-upper',     'Üst trapez',             'Trapezius (pars descendens)',   'upper'),
  ('traps-mid',       'Orta trapez',            'Trapezius (pars transversa)',   'upper'),
  ('traps-lower',     'Alt trapez',             'Trapezius (pars ascendens)',    'upper'),
  ('rhomboids',       'Romboidler',             'Rhomboideus major/minor',       'upper'),
  ('rear-delt',       'Arka omuz',              'Deltoideus (pars posterior)',   'upper'),
  ('side-delt',       'Yan omuz',               'Deltoideus (pars media)',       'upper'),
  ('front-delt',      'Ön omuz',                'Deltoideus (pars anterior)',    'upper'),
  ('biceps',          'Biceps',                 'Biceps brachii',                'upper'),
  ('brachialis',      'Brakialis',              'Brachialis',                    'upper'),
  ('triceps',         'Triceps',                'Triceps brachii',               'upper'),
  ('forearm-flexors', 'Ön kol bükücüler',       'Flexor carpi (forearm flexors)','upper'),
  ('quads',           'Quadriceps',             'Quadriceps femoris',            'lower'),
  ('hamstrings',      'Arka bacak (Hamstring)', 'Hamstrings (biceps femoris)',   'lower'),
  ('glutes',          'Kalça (Gluteus maximus)','Gluteus maximus',               'lower'),
  ('glute-med',       'Orta gluteal',           'Gluteus medius',                'lower'),
  ('calves',          'Baldır (Gastrocnemius)', 'Gastrocnemius',                 'lower'),
  ('soleus',          'Baldır (Soleus)',        'Soleus',                        'lower'),
  ('adductors',       'İç bacak (Addüktörler)', 'Adductores (hip adductors)',    'lower'),
  ('hip-flexors',     'Kalça bükücüler',        'Iliopsoas (hip flexors)',       'lower'),
  ('abs',             'Karın (Rektus)',         'Rectus abdominis',              'core'),
  ('obliques',        'Yan karın (Oblikler)',   'Obliquus abdominis',            'core'),
  ('erectors',        'Bel dikleştiriciler',    'Erector spinae',                'core')
ON CONFLICT (slug) DO UPDATE
  SET name_tr = EXCLUDED.name_tr,
      name_latin = EXCLUDED.name_latin,
      region = EXCLUDED.region;

-- ---------------------------------------------------------------------------
-- 2. Muscle functions (one row per distinct function of a muscle)
-- ---------------------------------------------------------------------------
INSERT INTO public.muscle_functions (muscle_id, slug, name_tr, name_technical)
SELECT m.id, v.slug, v.name_tr, v.name_technical
FROM (VALUES
  ('chest',           'chest-horizontal-adduction',    'Yatay addüksiyon',            'Shoulder horizontal adduction'),
  ('chest',           'chest-shoulder-flexion',        'Omuz fleksiyonu (üst göğüs)', 'Shoulder flexion'),
  ('lat',             'lat-shoulder-extension',        'Omuz ekstansiyonu',           'Shoulder extension'),
  ('lat',             'lat-shoulder-adduction',        'Omuz addüksiyonu',            'Shoulder adduction'),
  ('traps-upper',     'traps-elevation',               'Skapula elevasyonu',          'Scapular elevation'),
  ('traps-mid',       'traps-mid-retraction',          'Skapula retraksiyonu',        'Scapular retraction'),
  ('traps-lower',     'traps-depression',              'Skapula depresyonu',          'Scapular depression'),
  ('rhomboids',       'rhomboids-retraction',          'Skapula retraksiyonu',        'Scapular retraction'),
  ('rear-delt',       'rear-delt-horizontal-abduction','Yatay abduksiyon',            'Shoulder horizontal abduction'),
  ('side-delt',       'side-delt-abduction',           'Omuz abduksiyonu',            'Shoulder abduction'),
  ('front-delt',      'front-delt-shoulder-flexion',   'Omuz fleksiyonu',             'Shoulder flexion'),
  ('biceps',          'biceps-elbow-flexion',          'Dirsek fleksiyonu',           'Elbow flexion'),
  ('biceps',          'biceps-supination',             'Önkol supinasyonu',           'Forearm supination'),
  ('brachialis',      'brachialis-elbow-flexion',      'Dirsek fleksiyonu',           'Elbow flexion'),
  ('triceps',         'triceps-elbow-extension',       'Dirsek ekstansiyonu',         'Elbow extension'),
  ('forearm-flexors', 'forearm-wrist-flexion',         'Bilek fleksiyonu',            'Wrist flexion'),
  ('quads',           'quads-knee-extension',          'Diz ekstansiyonu',            'Knee extension'),
  ('hamstrings',      'hamstrings-knee-flexion',       'Diz fleksiyonu',              'Knee flexion'),
  ('hamstrings',      'hamstrings-hip-extension',      'Kalça ekstansiyonu',          'Hip extension'),
  ('glutes',          'glutes-hip-extension',          'Kalça ekstansiyonu',          'Hip extension'),
  ('glute-med',       'glute-med-hip-abduction',       'Kalça abduksiyonu',           'Hip abduction'),
  ('calves',          'calves-plantarflexion',         'Plantar fleksiyon (diz düz)', 'Plantarflexion (knee extended)'),
  ('soleus',          'soleus-plantarflexion',         'Plantar fleksiyon (diz bükük)','Plantarflexion (knee flexed)'),
  ('adductors',       'adductors-hip-adduction',       'Kalça addüksiyonu',           'Hip adduction'),
  ('hip-flexors',     'hip-flexors-hip-flexion',       'Kalça fleksiyonu',            'Hip flexion'),
  ('abs',             'abs-trunk-flexion',             'Gövde fleksiyonu',            'Trunk flexion'),
  ('obliques',        'obliques-rotation',             'Gövde rotasyonu',             'Trunk rotation'),
  ('obliques',        'obliques-lateral-flexion',      'Yana eğilme',                 'Lateral flexion'),
  ('erectors',        'erectors-spinal-extension',     'Bel ekstansiyonu',            'Spinal extension'),
  ('erectors',        'erectors-anti-flexion',         'Anti-fleksiyon (izometrik)',  'Anti-flexion (isometric)')
) AS v(muscle_slug, slug, name_tr, name_technical)
JOIN public.muscles m ON m.slug = v.muscle_slug
ON CONFLICT (slug) DO UPDATE
  SET name_tr = EXCLUDED.name_tr,
      name_technical = EXCLUDED.name_technical;
