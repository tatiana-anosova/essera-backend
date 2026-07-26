-- Profile provisioning for Supabase Auth.
--
-- Run this manually against Supabase (SQL Editor, or `supabase db execute` on the direct
-- connection) AFTER the Prisma migrations have been applied. It is not a Prisma migration
-- because it depends on auth.users, which only exists in a Supabase database, and creating a
-- trigger there requires a privileged role rather than the app's runtime DATABASE_URL role.
--
-- Safe to run repeatedly: the function is replaced, the trigger recreated, and existing
-- public.profiles rows (including their role) are never modified.

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
