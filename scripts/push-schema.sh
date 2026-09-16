#!/bin/sh
# Apply prisma/schema.prisma to the production database.
#
# Every path is absolute and the project's own Prisma is called directly, so
# this works from any directory and can never fall through to `npx`, which
# offers to download a newer major version when it cannot find a local one.
#
# Afterwards, run the RLS lockdown in the Supabase SQL editor — new tables
# arrive readable through Supabase's REST API, and psql is not installed here.
set -e

ROOT="/Users/josh/Cluade Code/Volunteer App/lighthouse-care-volunteers"

if [ ! -f "$ROOT/scripts/migrate/.sydney" ]; then
  echo "Missing $ROOT/scripts/migrate/.sydney — cannot reach the database."
  exit 1
fi

echo "Using $("$ROOT/node_modules/.bin/prisma" --version 2>/dev/null | head -1)"

"$ROOT/node_modules/.bin/prisma" db push \
  --schema "$ROOT/prisma/schema.prisma" \
  --url "$(cat "$ROOT/scripts/migrate/.sydney")"

echo
echo "Done. Now run the lockdown SQL in the Supabase SQL editor."
