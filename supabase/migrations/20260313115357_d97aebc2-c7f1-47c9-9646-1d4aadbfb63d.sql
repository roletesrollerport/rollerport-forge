
-- Revoke direct SELECT on senha column from anon role to prevent password leakage
REVOKE SELECT (senha) ON public.usuarios FROM anon;

-- Also revoke from public role for defense in depth
REVOKE SELECT (senha) ON public.usuarios FROM public;
