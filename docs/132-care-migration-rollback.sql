-- Rollback for docs/131 (only if that migration was applied).
DROP POLICY IF EXISTS care_routine_items_owner_write ON public.care_routine_items;
DROP POLICY IF EXISTS care_routine_items_owner_select ON public.care_routine_items;
DROP POLICY IF EXISTS care_feedback_owner_all ON public.care_feedback;
DROP POLICY IF EXISTS care_notifications_owner_all ON public.care_notifications;
DROP POLICY IF EXISTS care_suggestions_owner_all ON public.care_suggestions;
DROP POLICY IF EXISTS care_checkins_owner_all ON public.care_check_ins;
DROP POLICY IF EXISTS care_routines_owner_all ON public.care_routines;
DROP POLICY IF EXISTS care_sessions_owner_update ON public.care_analysis_sessions;
DROP POLICY IF EXISTS care_sessions_owner_insert ON public.care_analysis_sessions;
DROP POLICY IF EXISTS care_sessions_owner_select ON public.care_analysis_sessions;

DROP TABLE IF EXISTS public.care_feedback;
DROP TABLE IF EXISTS public.care_notifications;
DROP TABLE IF EXISTS public.care_suggestions;
DROP TABLE IF EXISTS public.care_check_ins;
DROP TABLE IF EXISTS public.care_routine_items;
DROP TABLE IF EXISTS public.care_routines;
DROP TABLE IF EXISTS public.care_analysis_sessions;
