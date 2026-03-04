CREATE TABLE IF NOT EXISTS public.rate_limits (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    identifier TEXT NOT NULL,
    endpoint   TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON public.rate_limits (identifier, endpoint, created_at DESC);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
    DELETE FROM public.rate_limits WHERE created_at < now() - interval '1 hour';
$$;
