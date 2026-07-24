-- ═══════════════════════════════════════════════════════════════
-- ADD EASTER EGGS REPORT REASON
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.content_reports'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%reason = ANY (ARRAY[%';

  IF v_conname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.content_reports DROP CONSTRAINT ' || quote_ident(v_conname);
  END IF;
END;
$$;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_reason_check
  CHECK (reason IN ('spam', 'harassment', 'misinformation', 'inappropriate', 'other', 'easter_eggs'));
