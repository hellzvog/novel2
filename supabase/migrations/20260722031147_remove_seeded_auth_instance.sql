/*
# Remove seeded auth instance

## Overview
The manually seeded auth.instances row has a JWT secret that doesn't match
the actual GoTrue server's secret. This causes "Database error querying
schema" during sign-in. We remove it so GoTrue can use its own internal
configuration.
*/

DELETE FROM auth.instances;
