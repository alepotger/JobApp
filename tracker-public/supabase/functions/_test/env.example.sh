# Local values for the test harness only. These are not secrets: nothing here
# reaches a real Supabase project or a real mail provider — the harness points
# the functions at a stub database on 127.0.0.1 and captures outbound mail to
# a file. Never point these at a live project.
export SUPABASE_URL="http://127.0.0.1:8801"
export SUPABASE_SERVICE_ROLE_KEY="local-harness-stub-not-a-real-key"
export INBOUND_SIGNING_SECRET="whsec_bG9jYWxoYXJuZXNzc2VjcmV0Zm9ydGVzdHM="
export INBOUND_SHARED_SECRET=""
export CRON_SECRET="local-harness-cron-secret"
export RESEND_API_KEY="re_local_harness_not_a_real_key"
export DIGEST_FROM="JobApp <digest@example.com>"
export APP_URL="https://example.com"
