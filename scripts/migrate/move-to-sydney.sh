#!/usr/bin/env bash
# Move the production database from Tokyo to Sydney.
#
#   ./scripts/migrate/move-to-sydney.sh "<new sydney session pooler url>"
#
# Reads the current database from .env.production.local. Dumps, restores, and
# then compares row counts table by table. It does NOT touch Vercel: the
# environment variable is swapped by hand afterwards, so the old database stays
# live and untouched until someone deliberately cuts over.
set -euo pipefail

PG_BIN=/opt/homebrew/opt/libpq/bin
TARGET="${1:?Pass the new Sydney connection string as the first argument}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT   # the dump holds donor records, so never leave it lying about

SOURCE="$(grep '^DATABASE_URL' .env.production.local | sed 's/^DATABASE_URL="//; s/"$//' | sed 's/:6543/:5432/')"

echo "==> Dumping from the current database"
"$PG_BIN/pg_dump" --no-owner --no-privileges --no-comments -n public -Fc "$SOURCE" -f "$WORK/dump.pgc"
echo "    $(du -h "$WORK/dump.pgc" | cut -f1) written"

echo "==> Restoring into the target"
"$PG_BIN/pg_restore" --no-owner --no-privileges --clean --if-exists -n public -d "$TARGET" "$WORK/dump.pgc" 2>"$WORK/restore.log" || {
  echo "    pg_restore reported problems:"; tail -20 "$WORK/restore.log"; }

echo "==> Comparing row counts"
node scripts/migrate/rowcounts.mjs "$SOURCE" > "$WORK/source.json"
node scripts/migrate/rowcounts.mjs "$TARGET" > "$WORK/target.json"
node - "$WORK/source.json" "$WORK/target.json" <<'JS'
const fs = require('fs')
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const b = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
let bad = 0
for (const n of names) {
  const from = a[n] ?? 0
  const to = b[n] ?? 0
  if (from !== to) {
    bad++
    console.log(`  MISMATCH ${n.padEnd(26)} source ${from}  target ${to}`)
  }
}
const total = Object.values(a).reduce((x, y) => x + y, 0)
if (bad === 0) console.log(`  every table matches. ${names.length} tables, ${total} rows.`)
else console.log(`\n  ${bad} table(s) differ. DO NOT switch over.`)
process.exit(bad === 0 ? 0 : 1)
JS

echo
echo "==> Done. The app is still pointed at the old database."
echo "    To cut over: set DATABASE_URL in Vercel (Production and Preview) to the"
echo "    new connection string with port 6543, then redeploy."
