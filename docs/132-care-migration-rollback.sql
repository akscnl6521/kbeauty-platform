-- Rollback for continuous care persistence (MANUAL ONLY — do not auto-run).
-- Drops care policies/tables. Does NOT touch products/ingredients/pipeline.
-- Prefer soft-disable over DROP in production.

DROP POLICY IF EXISTS care_routine_items_owner_update ON public.care_routine_items;
DROP POLICY IF EXISTS care_routine_items_owner_insert ON public.care_routine_items;
DROP POLICY IF EXISTS care_routine_items_owner_select ON public.care_routine_items;
DROP POLICY IF EXISTS care_progress_owner_update ON public.care_progress_snapshots;
DROP POLICY IF EXISTS care_progress_owner_insert ON public.care_progress_snapshots;
DROP POLICY IF EXISTS care_progress_owner_select ON public.care_progress_snapshots;
DROP POLICY IF EXISTS care_feedback_owner_update ON public.care_feedback;
DROP POLICY IF EXISTS care_feedback_owner_insert ON public.care_feedback;
DROP POLICY IF EXISTS care_feedback_owner_select ON public.care_feedback;
DROP POLICY IF EXISTS care_notifications_owner_update ON public.care_notifications;
DROP POLICY IF EXISTS care_notifications_owner_insert ON public.care_notifications;
DROP POLICY IF EXISTS care_notifications_owner_select ON public.care_notifications;
DROP POLICY IF EXISTS care_suggestions_owner_update ON public.care_suggestions;
DROP POLICY IF EXISTS care_suggestions_owner_insert ON public.care_suggestions;
DROP POLICY IF EXISTS care_suggestions_owner_select ON public.care_suggestions;
DROP POLICY IF EXISTS care_checkins_owner_update ON public.care_check_ins;
DROP POLICY IF EXISTS care_checkins_owner_insert ON public.care_check_ins;
DROP POLICY IF EXISTS care_checkins_owner_select ON public.care_check_ins;
DROP POLICY IF EXISTS care_routines_owner_update ON public.care_routines;
DROP POLICY IF EXISTS care_routines_owner_insert ON public.care_routines;
DROP POLICY IF EXISTS care_routines_owner_select ON public.care_routines;
DROP POLICY IF EXISTS care_sessions_owner_update ON public.care_analysis_sessions;
DROP POLICY IF EXISTS care_sessions_owner_insert ON public.care_analysis_sessions;
DROP POLICY IF EXISTS care_sessions_owner_select ON public.care_analysis_sessions;

-- Legacy names from earlier draft
DROP POLICY IF EXISTS care_routine_items_owner_write ON public.care_routine_items;
DROP POLICY IF EXISTS care_feedback_owner_all ON public.care_feedback;
DROP POLICY IF EXISTS care_notifications_owner_all ON public.care_notifications;
DROP POLICY IF EXISTS care_suggestions_owner_all ON public.care_suggestions;
DROP POLICY IF EXISTS care_checkins_owner_all ON public.care_check_ins;
DROP POLICY IF EXISTS care_routines_owner_all ON public.care_routines;

DROP TABLE IF EXISTS public.care_audit_events;
DROP TABLE IF EXISTS public.care_progress_snapshots;
DROP TABLE IF EXISTS public.care_feedback;
DROP TABLE IF EXISTS public.care_notifications;
DROP TABLE IF EXISTS public.care_suggestions;
DROP TABLE IF EXISTS public.care_check_ins;
DROP TABLE IF EXISTS public.care_routine_items;
DROP TABLE IF EXISTS public.care_routines;
DROP TABLE IF EXISTS public.care_analysis_sessions;
