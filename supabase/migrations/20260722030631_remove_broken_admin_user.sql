/*
# Remove broken admin user

## Overview
The manually inserted admin user has a mismatched instance_id and the
auth.instances table is empty, causing GoTrue to fail with "database error
querying schema". We delete the broken user and will recreate it via the
Supabase Auth API (signUp) which properly sets up all internal fields.
*/

DELETE FROM profiles WHERE email = 'admin@lumennovel.com';
DELETE FROM auth.users WHERE email = 'admin@lumennovel.com';
