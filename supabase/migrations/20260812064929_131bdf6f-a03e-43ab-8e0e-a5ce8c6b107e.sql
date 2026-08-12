ALTER TABLE public.timer_state ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_timer_state_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timer_state_bump_revision ON public.timer_state;
CREATE TRIGGER timer_state_bump_revision
BEFORE UPDATE ON public.timer_state
FOR EACH ROW EXECUTE FUNCTION public.bump_timer_state_revision();