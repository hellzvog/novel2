/*
# Clean up manually created admin user

## Overview
Delete the manually inserted admin user so the edge function can create
a proper one via the Supabase Admin API.
*/

DELETE FROM profiles WHERE email = 'admin@lumennovel.com';
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@lumennovel.com');
DELETE FROM auth.users WHERE email = 'admin@lumennovel.com';
