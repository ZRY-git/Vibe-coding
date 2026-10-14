INSERT INTO public.words (word, meaning, pack_id, status) VALUES
  ('apple', '苹果',     'daily',  'done'),
  ('book',  '书',       'daily',  'done'),
  ('cat',   '猫',       'daily',  'doing'),
  ('dog',   '狗',       'daily',  'doing'),
  ('egg',   '鸡蛋',     'daily',  'todo'),
  ('rain',  '雨',       'travel', 'done'),
  ('snow',  '雪',       'travel', 'doing'),
  ('train', '火车',     'travel', 'doing'),
  ('bus',   '公共汽车', 'travel', 'todo'),
  ('wind',  '风',       'travel', 'todo')
ON CONFLICT (word) DO UPDATE
  SET meaning = EXCLUDED.meaning,
      pack_id = EXCLUDED.pack_id;

INSERT INTO public.answer_logs (word_id, correct, energy_gained, answered_at)
SELECT w.id, v.correct, v.energy_gained, v.answered_at
FROM (
  VALUES
    ('apple', TRUE,  10, '2026-10-08 20:15:00+08'::timestamptz),
    ('book',  TRUE,  10, '2026-10-08 20:16:00+08'::timestamptz),
    ('apple', TRUE,  10, '2026-10-10 21:02:00+08'::timestamptz),
    ('cat',   FALSE,  0, '2026-10-10 21:05:00+08'::timestamptz),
    ('cat',   TRUE,  12, '2026-10-12 19:40:00+08'::timestamptz),
    ('dog',   TRUE,  12, '2026-10-12 19:41:00+08'::timestamptz),
    ('rain',  TRUE,  12, '2026-10-13 20:10:00+08'::timestamptz),
    ('snow',  FALSE,  0, '2026-10-13 20:12:00+08'::timestamptz),
    ('train', TRUE,  12, '2026-10-13 20:14:00+08'::timestamptz)
) AS v(word, correct, energy_gained, answered_at)
JOIN public.words AS w ON w.word = v.word
WHERE NOT EXISTS (
  SELECT 1 FROM public.answer_logs AS a
  WHERE a.word_id = w.id
    AND a.answered_at = v.answered_at
);
