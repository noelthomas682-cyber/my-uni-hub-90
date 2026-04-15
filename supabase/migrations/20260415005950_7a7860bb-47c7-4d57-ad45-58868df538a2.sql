
DROP INDEX IF EXISTS public.idx_assignments_user_external;
DROP INDEX IF EXISTS public.idx_calendar_events_user_external;

ALTER TABLE public.assignments 
ADD CONSTRAINT uq_assignments_user_external UNIQUE (user_id, external_id);

ALTER TABLE public.calendar_events 
ADD CONSTRAINT uq_calendar_events_user_external UNIQUE (user_id, external_id);
