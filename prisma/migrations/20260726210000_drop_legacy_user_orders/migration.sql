-- Drop the legacy int-PK user graph. Supabase auth.users + public.profiles is now the only user model.
-- These tables are empty; orders will be re-modelled against profiles.user_id when needed.

DROP TABLE IF EXISTS "public"."OrderItem";
DROP TABLE IF EXISTS "public"."Order";
DROP TABLE IF EXISTS "public"."User";
