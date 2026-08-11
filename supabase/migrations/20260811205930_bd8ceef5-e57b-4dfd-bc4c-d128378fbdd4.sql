-- Speakers: read-only for the public, writes only via server (service role)
DROP POLICY IF EXISTS "Public can manage speakers" ON public.speakers;
CREATE POLICY "Anyone can view speakers"
ON public.speakers FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.speakers FROM anon, authenticated;
GRANT SELECT ON public.speakers TO anon, authenticated;
GRANT ALL ON public.speakers TO service_role;

-- Timer state: read-only for the public, writes only via server (service role)
DROP POLICY IF EXISTS "Public can manage timer state" ON public.timer_state;
CREATE POLICY "Anyone can view timer state"
ON public.timer_state FOR SELECT TO anon, authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.timer_state FROM anon, authenticated;
GRANT SELECT ON public.timer_state TO anon, authenticated;
GRANT ALL ON public.timer_state TO service_role;