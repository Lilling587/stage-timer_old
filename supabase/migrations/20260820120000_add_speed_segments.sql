-- Mirror the timer speed in the database so stage screens on networks that
-- block WebSockets still follow speed changes via the polled timer_state row.
alter table public.timer_state
  add column if not exists speed_segments jsonb not null
    default '[{"from": 0, "rate": 1}]'::jsonb;
