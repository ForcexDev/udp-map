-- ═══════════════════════════════════════════════════════════════
-- ADD EASTER EGG PIN CATEGORY
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.categories (id, kind, name, name_en, color, svg_path, ttl_hours)
VALUES (
  'easter-egg',
  'report',
  'Easter Egg',
  'Easter Egg',
  '#a855f7',
  'M12 2C8 2 5 6 5 12c0 5 3 10 7 10s7-5 7-10c0-6-3-10-7-10z',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind,
  name = EXCLUDED.name,
  name_en = EXCLUDED.name_en,
  color = EXCLUDED.color,
  svg_path = EXCLUDED.svg_path,
  ttl_hours = EXCLUDED.ttl_hours;
