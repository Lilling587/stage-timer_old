CREATE TABLE public.speakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 20,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.speakers TO anon, authenticated;
GRANT ALL ON public.speakers TO service_role;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage speakers" ON public.speakers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.timer_state (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
  current_speaker_id UUID REFERENCES public.speakers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  message TEXT,
  message_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timer_state TO anon, authenticated;
GRANT ALL ON public.timer_state TO service_role;
ALTER TABLE public.timer_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage timer state" ON public.timer_state FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.timer_state (id) VALUES ('main');

ALTER PUBLICATION supabase_realtime ADD TABLE public.speakers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timer_state;
ALTER TABLE public.speakers REPLICA IDENTITY FULL;
ALTER TABLE public.timer_state REPLICA IDENTITY FULL;