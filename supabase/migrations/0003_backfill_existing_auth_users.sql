-- Backfill application profile rows for users who existed before the signup trigger
-- was installed. Idempotent: preserve existing profile rows and settings.
INSERT INTO public.users (id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

INSERT INTO public.profiles (user_id, display_name)
SELECT id, COALESCE(NULLIF(split_part(email, '@', 1), ''), 'Creator')
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
