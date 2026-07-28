/*
# Remove and re-seed auth instance with full config

## Overview
The empty raw_base_config didn't help. Let's try with a full config.
*/

DELETE FROM auth.instances;

INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  jsonb_build_object(
    'SITE_URL', 'http://localhost:5173',
    'API_MAX_REQUEST_DURATION', '10s',
    'GOTRUE_JWT_SECRET', 'super-secret-jwt-token-with-at-least-32-characters-for-testing',
    'GOTRUE_JWT_EXP', '3600',
    'GOTRUE_JWT_AUD', 'authenticated',
    'GOTRUE_JWT_ADMIN_ROLES', '["service_role"]'::jsonb,
    'GOTRUE_JWT_DEFAULT_GROUP', 'authenticated',
    'GOTRUE_DB_DRIVER', 'postgres',
    'GOTRUE_MAILER_AUTOCONFIRM', 'true',
    'GOTRUE_SMTP_ADMIN_EMAIL', 'admin@example.com',
    'GOTRUE_MAILER_URLPATHS_INVITE', '/auth/v1/verify',
    'GOTRUE_MAILER_URLPATHS_CONFIRMATION', '/auth/v1/verify',
    'GOTRUE_MAILER_URLPATHS_RECOVERY', '/auth/v1/verify',
    'GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE', '/auth/v1/verify',
    'GOTRUE_SECURITY_MANUAL_LINKING_ENABLED', 'true'
  )::text,
  now(),
  now();
