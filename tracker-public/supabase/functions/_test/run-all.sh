#!/usr/bin/env bash
# Runs both Edge Functions for real and drives them over HTTP.
#
#   ./run-all.sh
#
# Needs deno and node on PATH. The function sources are imported unmodified;
# three things are redirected, all environmental:
#   - the Supabase client specifier (jsr -> npm) via deno.json, so the harness
#     works on a machine that cannot reach jsr.io
#   - the listen port, which Deno.serve otherwise fixes at 8000
#   - api.resend.com, captured to outbox.jsonl instead of sent
# The database is a stub speaking PostgREST on 127.0.0.1:8801, so the real
# supabase-js query builder, filters and error codes are exercised.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

command -v deno >/dev/null || { echo "deno not found on PATH"; exit 1; }
command -v node >/dev/null || { echo "node not found on PATH"; exit 1; }

# The dashboard bundles are generated from these same sources. If someone edits
# _shared/ or a function entry point and forgets to rebuild, the browser deploy
# path would ship code these tests never ran. Fail here rather than there.
node "$HERE/../_dashboard/build.mjs" --check || {
  echo "dashboard bundles are stale — run: node supabase/functions/_dashboard/build.mjs"
  exit 1
}

cleanup() {
  pkill -f "$HERE/fake-supabase.js" 2>/dev/null
  pkill -f "$HERE/run-inbound.ts"   2>/dev/null
  pkill -f "$HERE/run-digest.ts"    2>/dev/null
}
trap cleanup EXIT
cleanup; sleep 1
rm -f outbox.jsonl

source "${ENV_FILE:-$HERE/env.example.sh}"

nohup node "$HERE/fake-supabase.js" > db.log 2>&1 &
PORT=8802 nohup deno run --allow-all --config deno.json "$HERE/run-inbound.ts" > inbound.log 2>&1 &
PORT=8803 nohup deno run --allow-all --config deno.json "$HERE/run-digest.ts"  > digest.log 2>&1 &

for _ in $(seq 1 60); do
  ok=1
  curl -sf -o /dev/null --noproxy 127.0.0.1 http://127.0.0.1:8801/__state || ok=0
  curl -s  -o /dev/null --noproxy 127.0.0.1 http://127.0.0.1:8802/ || ok=0
  curl -s  -o /dev/null --noproxy 127.0.0.1 -X POST http://127.0.0.1:8803/ || ok=0
  [ "$ok" = 1 ] && break
  sleep 1
done
[ "${ok:-0}" = 1 ] || { echo "functions did not come up:"; tail -20 inbound.log digest.log; exit 1; }

fail=0
echo "=== inbound-email ==="
node "$HERE/inbound-suite.js" || fail=1
echo
echo "=== weekly-digest ==="
node "$HERE/digest-suite.js"  || fail=1
exit $fail
