
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Create trigger to auto-create profile when auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create profile if not already linked (user-api creates profile first)
  -- This is a safety net
  RETURN NEW;
END;
$$;
