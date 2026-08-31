-- ============================================================================
-- Already applied to production on 2026-08-31. Safe to replay (every statement
-- is idempotent).
--
-- Restore order status updates, and stop a notification from being able to
-- abort fulfilment.
--
-- WHAT WAS BROKEN
-- ---------------
-- `20260313091000_order_status_webhook.sql` installed an AFTER UPDATE trigger on
-- `orders` that calls `net.http_post(...)`. It never installed `pg_net`, so the
-- `net` schema did not exist. PL/pgSQL resolves that call at run time, so every
-- status change raised `schema "net" does not exist` — and because the trigger
-- ran inside the caller's transaction, the exception rolled the whole UPDATE
-- back.
--
-- Every order status change in the database has failed since that migration was
-- applied on 2026-03-13. The last successful status change is 2026-03-08. That
-- froze the entire fulfilment pipeline: admins could not confirm, ship or
-- deliver an order, `cancel_order` could not cancel one, and
-- `delhivery-create-shipment` could not record the waybill it had just paid
-- Delhivery to create.
--
-- WHAT THIS MIGRATION DOES
-- ------------------------
--   1. Installs pg_net so the dispatch can actually work.
--   2. Wraps the dispatch in its own exception block. A push notification is
--      best-effort; it must never be able to roll back the business fact that
--      triggered it. This is the fix that matters — without it the next missing
--      dependency freezes fulfilment all over again.
--   3. Authenticates the call with a Vault secret instead of
--      `current_setting('supabase.service_role_key', true)`, a GUC that is not
--      set on Supabase, so the header was literally null.
--   4. Sends only the order id and status instead of `row_to_json(NEW)`. The old
--      payload shipped the customer's name, phone and full shipping address to a
--      function with `verify_jwt: false`. The function re-reads the order from
--      the database anyway, so the identifiers are all it ever needed.
--   5. Moves the status-change test into a trigger WHEN clause so unrelated
--      order updates do not enter the function at all.
-- ============================================================================

-- ── 1. pg_net ───────────────────────────────────────────────────────────────
-- pg_net creates and owns its own `net` schema regardless of the schema named
-- here, so do not pre-create it — `CREATE SCHEMA net` first makes the extension
-- fail with "schema net is not a member of extension pg_net".
create extension if not exists pg_net;

-- Client roles have no business making outbound HTTP requests from the database.
-- PostgREST does not expose the `net` schema today, so this is depth rather than
-- a live hole, but the grant should never have been reachable.
revoke all on schema net from anon, authenticated;
revoke all on all functions in schema net from anon, authenticated;
revoke all on all tables in schema net from anon, authenticated;

-- ── 2. Shared secret for the notification endpoint ──────────────────────────
-- `send-order-notification` runs with verify_jwt disabled so the trigger can
-- reach it, which means anyone on the internet can POST to it. Vault gives both
-- sides a secret without putting one in this file, in the Edge Function source,
-- or in a dashboard setting: the trigger reads it here, and the function checks
-- it through `verify_notify_secret` below, so the secret itself never leaves the
-- database.
do $$
begin
    if not exists (select 1 from vault.secrets where name = 'order_notify_secret') then
        perform vault.create_secret(
            encode(extensions.gen_random_bytes(32), 'hex'),
            'order_notify_secret',
            'Shared secret proving a send-order-notification call came from the orders trigger',
            null
        );
    end if;
end $$;

create or replace function public.verify_notify_secret(p_secret text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
DECLARE
    v_secret text;
BEGIN
    IF p_secret IS NULL OR p_secret = '' THEN
        RETURN false;
    END IF;

    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = 'order_notify_secret';

    IF v_secret IS NULL THEN
        RETURN false;
    END IF;

    -- Compare digests rather than the raw strings so the comparison cannot leak
    -- how many leading characters a guess got right.
    RETURN extensions.hmac(p_secret, 'notify', 'sha256')
         = extensions.hmac(v_secret,  'notify', 'sha256');
END;
$$;

revoke all on function public.verify_notify_secret(text) from public, anon, authenticated;
grant execute on function public.verify_notify_secret(text) to service_role;

-- ── 3. Fail-safe dispatch ───────────────────────────────────────────────────
create or replace function public.notify_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
DECLARE
    v_secret text;
BEGIN
    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    -- Everything below is best-effort. A failed notification must never roll
    -- back the status change that produced it.
    BEGIN
        IF to_regnamespace('net') IS NULL THEN
            RAISE WARNING 'pg_net is not installed; skipping order notification for %', NEW.id;
            RETURN NEW;
        END IF;

        SELECT decrypted_secret INTO v_secret
          FROM vault.decrypted_secrets
         WHERE name = 'order_notify_secret';

        PERFORM net.http_post(
            url := 'https://yghqsrcmqvcwazksrxlk.supabase.co/functions/v1/send-order-notification',
            headers := jsonb_build_object(
                'Content-Type',    'application/json',
                'x-notify-secret', coalesce(v_secret, '')
            ),
            body := jsonb_build_object(
                'type',   'UPDATE',
                'table',  'orders',
                'schema', 'public',
                -- Identifiers only. The function re-reads the order itself.
                'record',     jsonb_build_object('id', NEW.id, 'status', NEW.status),
                'old_record', jsonb_build_object('id', OLD.id, 'status', OLD.status)
            )
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'order notification dispatch failed for order %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

drop trigger if exists trg_order_status_push_notification on public.orders;
create trigger trg_order_status_push_notification
    after update on public.orders
    for each row
    when (old.status is distinct from new.status)
    execute function public.notify_order_status_change();
