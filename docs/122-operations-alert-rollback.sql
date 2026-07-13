-- Rollback for docs/121 (only if applied). Do NOT run unless rolling back that migration.
DROP TABLE IF EXISTS public.operations_alert_acknowledgements;
DROP TABLE IF EXISTS public.operations_alert_events;
DROP TABLE IF EXISTS public.operations_alerts;
