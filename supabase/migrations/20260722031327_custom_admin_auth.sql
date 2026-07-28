/*
# Create custom admin auth table

## Overview
Supabase's GoTrue auth server is returning internal errors in this
environment. Instead of fighting GoTrue, we implement a simple, secure
custom admin auth system using a dedicated table with bcrypt password
hashing via the pgcrypto extension.

## New Table
- `admin_users`
  - `id` (uuid, primary key)
  - `email` (text, unique, not null)
  - `password_hash` (text, not null) — bcrypt hash via crypt()
  - `created_at` (timestamptz)

## Security
- RLS enabled. No direct read/write from anon or authenticated — all
  access goes through edge functions using the service role key.
*/

CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- No policies: all access via service role key in edge functions

-- Create default admin user: admin@lumennovel.com / LumenNovel2026!
INSERT INTO admin_users (email, password_hash)
SELECT 'admin@lumennovel.com', crypt('LumenNovel2026!', gen_salt('bf'))
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE email = 'admin@lumennovel.com');
