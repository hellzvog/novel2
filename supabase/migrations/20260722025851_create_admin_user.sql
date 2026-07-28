/*
# Create default admin user

## Overview
Creates a default admin user for the CMS login.

## Credentials
- Email: admin@lumennovel.com
- Password: Admin123!

## Notes
- Email confirmation is bypassed.
- Profile row created with is_admin = true.
*/

DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Check if admin user already exists
  SELECT id INTO admin_id FROM auth.users WHERE email = 'admin@lumennovel.com';

  IF admin_id IS NULL THEN
    -- Create the admin user
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'admin@lumennovel.com',
      crypt('Admin123!', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb
    )
    RETURNING id INTO admin_id;
  END IF;

  -- Create or update profile with is_admin = true
  INSERT INTO profiles (id, email, is_admin)
  SELECT id, email, true FROM auth.users WHERE email = 'admin@lumennovel.com'
  ON CONFLICT (id) DO UPDATE SET is_admin = true;
END $$;
