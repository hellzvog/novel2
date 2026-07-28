/*
# Re-seed auth instance with proper config

## Overview
GoTrue requires an instance row in auth.instances. We insert one with
a standard configuration. The JWT secret here is a placeholder — GoTrue
uses its own internal secret for token signing, but the instance row
must exist for user creation to work.
*/

INSERT INTO auth.instances (id, uuid, raw_base_config, created_at, updated_at)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  '{}'::text,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM auth.instances);
