-- ============================================================================
-- Hide internal tables from the API surface, and stop `rate_limits` growing
-- without bound.
--
-- Already applied to production on 2026-08-31. Safe to replay.
--
-- `admin_users` and `rate_limits` both have RLS enabled with no policies, so no
-- client could read them — but the SELECT grant still published both in the
-- GraphQL schema, advertising internal structure to anyone holding the anon key.
-- `is_admin()` is SECURITY DEFINER and owned by `postgres`, so revoking the
-- client grant does not affect it and every RLS policy that calls it keeps
-- working.
--
-- `rate_limits` had 460 rows going back to the day it was created. Rows are only
-- ever read inside a sliding window of at most a few minutes, so everything
-- older is dead weight on the table and its index. pg_cron is not installed on
-- this project, so rather than add scheduling infrastructure for one janitorial
-- delete, the table prunes itself from its own insert path.
-- ============================================================================

revoke select on public.admin_users from anon, authenticated;
revoke select on public.rate_limits from anon, authenticated;

create or replace function public.prune_rate_limits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
BEGIN
    -- Roughly one insert in 200 pays for the cleanup. A statement-level trigger
    -- keeps this off the per-row path.
    IF random() < 0.005 THEN
        DELETE FROM rate_limits WHERE created_at < now() - interval '1 day';
    END IF;
    RETURN NULL;
END;
$$;

drop trigger if exists trg_prune_rate_limits on public.rate_limits;
create trigger trg_prune_rate_limits
    after insert on public.rate_limits
    for each statement execute function public.prune_rate_limits();

delete from rate_limits where created_at < now() - interval '1 day';
