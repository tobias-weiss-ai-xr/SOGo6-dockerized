# Proposal: Enable LDAP directory auth in Stalwart (community build — NO fork)

## Status

**Resolved via configuration — no fork required.** The goal (Stalwart authenticates
the demo LDAP users so SOGo mail works) is achieved against the stock
`stalwartlabs/stalwart:0.16.19` community image. The original plan assumed the LDAP
directory backend was enterprise-gated and required a fork; empirical verification
(2026-08-29) proved it is **not** gated.

## Why

SOGo mail (IMAP/SMTP submission) could not authenticate the demo LDAP users; every
`IMAP AUTHENTICATE PLAIN testuser@example.org/password123` returned
`AUTHENTICATIONFAILED`, so `MAIL_BACKEND_AVAILABLE=False` and the mail surface stayed
gated/skipped. The original hypothesis was that the LDAP directory backend is
enterprise-gated and would need a custom fork. Verification disproved that: the
`directory` crate unconditionally compiles `LdapDirectory`, `x:Directory/set` works in
community, and the real blocker was simply missing configuration. We change this so the
mail surface works on the unmodified community image (no fork, no enterprise license,
no custom-build maintenance).

## What Changes

1. `sogo6/stalwart/config.toml` and `config.test.toml`:
   - `filter = "(|(uid={username})(mail={username}))"` (login-scoped placeholder).
   - `bind-authentication = true`.
   - `[authentication] directoryId = "ldap"` (LDAP is the default auth directory).
2. Live store configured via management API (persisted in `sogo6_sogo6-stalwart-data`):
   `x:Directory/set` (`@type:"Ldap"`, store-schema keys) + `x:Authentication/set
   directoryId`.
3. `tests/integration/test_ldap_mail_auth.py` — the TDD acceptance test (GREEN).
4. `tests/GAP-ANALYSIS.md` §3 corrected (the "community build gates the directory"
   conclusion was wrong; §3.3 principal surgery now obsolete).

## What we actually found (the real root cause)

The blocker was **missing configuration**, not an enterprise gate:

1. `config.toml` / `config.test.toml` used `filter = "(objectClass=inetOrgPerson)"`
   with **no `{username}`/`{email}` placeholder** → Stalwart's `LdapFilter::build`
   matched *every* entry and bound the first one found → failed.
2. No `bind-authentication = true` → Stalwart compared the stored hash locally, which
   needs the admin bind to *read* `userPassword` (it cannot) → failed.
3. The LDAP directory was never set as the **default auth directory**
   (`Authentication.directoryId` was `null`) → IMAP auth consulted no directory.

## Verification (no fork, no enterprise license)

- `x:Directory/set` create `@type:"Ldap"` → `created:{id:"jcbkeh0qaaqa"}` (works in
  community; `Directory::Ldap` is always compiled).
- `x:Directory/query` → `ids:["jcbkeh0qaaqa"]` (directory loaded).
- `x:Authentication/set` `directoryId` → `updated:{singleton:null}`.
- `IMAP AUTHENTICATE PLAIN testuser@example.org/password123` →
  **`a2 OK ... Authentication successful`**.
- `testadmin@example.org`, `testuser2@example.org` also authenticate.
- `MAIL_BACKEND_AVAILABLE` → `True`; `tests/integration/test_ldap_mail_auth.py` is GREEN.

## Fork status

**Not needed.** The fork (`tobias-weiss-ai-xr/stalwart`, branch `ldap-community`) and
the release build were scoped but are **superseded** by the config fix — building a
custom image would add maintenance cost for zero functional gain. If a future need
arises for a genuinely enterprise-gated feature, the fork plan can be revived; for LDAP
directory auth it is unnecessary.

## Out of scope

- Other enterprise features (AD sync, SAML/SCIM, clustering, etc.).
- Changing SOGo's own LDAP consumer (already worked).
