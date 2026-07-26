-- Provision a public.profiles row for every Supabase auth user.
-- Names come from the sign-up metadata (snake_case or camelCase), role defaults to CUSTOMER.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'firstName'), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'lastName'), ''),
    'CUSTOMER'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill: existing auth users without a profile. Existing profiles are left untouched.
INSERT INTO public.profiles (user_id, email, first_name, last_name, role)
SELECT
  u.id,
  u.email,
  NULLIF(COALESCE(u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'firstName'), ''),
  NULLIF(COALESCE(u.raw_user_meta_data ->> 'last_name', u.raw_user_meta_data ->> 'lastName'), ''),
  'CUSTOMER'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT DO NOTHING;
