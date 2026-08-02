# tracker-public

The deployable application. `index.html` is the whole thing — no build step, no
bundler, no dependencies to install.

**The documentation lives at the [repository root](../README.md):** what it
does, the deploy button, getting started, signing in and troubleshooting, and
the optional email functions. It is kept in one place so the two cannot drift.

## This folder

```
index.html                        the entire application
LICENSE
supabase/
  setup.sql                       run this first; also upgrades an older table
  migrations/
    001-offer-scoring.sql         offer fields, company scoring, stage history
    002-inbound-and-digest.sql    inbound email + digest tables (optional)
  functions/
    README.md                     deploying the Edge Functions
    inbound-email/                webhook: files a reply against an application
    weekly-digest/                cron: emails what has gone quiet
    _shared/                      matching, digest text, signature checks
```

Any static host serves this folder as-is. The
[`netlify.toml`](../netlify.toml) at the repository root points here, so the
deploy button needs no configuration.
