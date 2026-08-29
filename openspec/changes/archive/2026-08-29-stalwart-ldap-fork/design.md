# Design: Enable LDAP directory auth in Stalwart (community build — config only)

> **Pivot (2026-08-29):** originally this change forked Stalwart to un-gate the LDAP
> directory. Verification proved the LDAP directory backend is **not** enterprise-gated
> in the community build — it just needed correct configuration. This document now
> records the **actual, verified config fix** (no fork, no custom image). The fork
> plan (below, struck through) is retained only as a fallback note.

## Context / current state (verified against v0.16.19 source + live container)

- `crates/directory/Cargo.toml` lists `ldap3` as a **non-optional** dependency.
- `crates/directory/src/lib.rs` declares `pub enum Directory { Ldap(LdapDirectory),
  Sql(SqlDirectory), OpenId(OpenIdDirectory) }` — `LdapDirectory` is always compiled.
- `x:Directory/set` and `x:Directory/get` work in the community image (no gate).
- **The earlier "gated" diagnosis was wrong.** The live `x:Directory/query` returned
  `ids:[]` only because **no LDAP directory was ever activated** (config.toml's block
  was never applied to the store, and it was mis-configured). `x:Account/set` being a
  no-op is a *separate* limitation of the internal-account management surface and is
  irrelevant to LDAP auth (which provisions principals on the fly).

## Target architecture (no fork)

```
 sogo6-ldap (OpenLDAP, dc=example,dc=org)
        │  ldap://sogo6-ldap:389  (bind cn=admin,dc=example,dc=org)
        ▼
 sogo6-stalwart  (STOCK stalwartlabs/stalwart:0.16.19 — LDAP directory configured)
        │  IMAP/SMTP/submission
        ▼
 sogo6-server (SOGo)  ──  mail auth now works → MAIL_BACKEND_AVAILABLE=True
```

Stalwart provisions a **principal on the fly** from each LDAP directory entry, so no
manual store surgery is needed.

## What was actually wrong (three missing config items)

1. **No login-scoped `filter`.** `filter = "(objectClass=inetOrgPerson)"` has no
   `{username}`/`{email}` placeholder → `LdapFilter::build` matches *every* entry and
   `find_object` binds the first one returned → fails.
2. **No `bind-authentication`.** Default auth compares the stored hash locally, which
   needs the admin bind to *read* `userPassword` (it cannot) → fails.
3. **LDAP directory not the default auth directory.** `Authentication.directoryId`
   (which sets `default_directory`) was `null` → IMAP auth consulted no directory.

## LDAP directory configuration (the fix)

### A) Fresh deploy — `sogo6/stalwart/config.toml` (and `config.test.toml`)

```toml
[directory."ldap"]
type = "ldap"
addresses = ["ldap://sogo6-ldap:389"]
bind-dn = "cn=admin,dc=example,dc=org"
# Password injected from the vault (.env) — never hardcoded.
bind-password = { type = "env", value = "LDAP_ADMIN_PASSWORD" }
base-dn = "ou=users,dc=example,dc=org"
# REQUIRED placeholder: without it Stalwart matches every entry and binds the first.
filter = "(|(uid={username})(mail={username}))"
# Authenticate by binding as the user (not by comparing the stored hash).
bind-authentication = true

# Use the LDAP directory as the default authentication source.
[authentication]
directoryId = "ldap"
```

### B) Existing store — apply via the management API (idempotent)

Store-schema keys differ from the TOML layer (`bind-password` → `bindSecret`,
`filter` → `filterLogin`, etc.). `bindSecret` uses `{"@type":"Value","secret":...}`.

```bash
# Basic auth = admin:STALWART_SECRET (from vault); JMAP port 8080
curl -X POST http://127.0.0.1:8080/jmap -H 'Authorization: Basic <b64(admin:SECRET)>' \
  -H 'Content-Type: application/json' -d '{
    "using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],
    "methodCalls":[["x:Directory/set",{"accountId":"0","create":{"ldap":{
      "@type":"Ldap","description":"Local OpenLDAP (dc=example,dc=org)",
      "url":"ldap://sogo6-ldap:389","bindDn":"cn=admin,dc=example,dc=org",
      "bindSecret":{"@type":"Value","secret":"<LDAP_ADMIN_PASSWORD>"},
      "bindAuthentication":true,"baseDn":"ou=users,dc=example,dc=org",
      "filterLogin":"(|(uid={username})(mail={username}))"}}},"c1"]}]}'
# then make it the default auth directory (singleton id is literally "singleton"):
curl -X POST http://127.0.0.1:8080/jmap -H 'Authorization: Basic <b64(admin:SECRET)>' \
  -H 'Content-Type: application/json' -d '{
    "using":["urn:ietf:params:jmap:core","urn:stalwart:jmap"],
    "methodCalls":[["x:Authentication/set",{"accountId":"0",
      "update":{"singleton":{"directoryId":"<ldap-id-from-create>"}}},"c1"]}]}'
# listeners/directories do not hot-reload: docker restart sogo6-stalwart
```

## Verification (DONE — TDD GREEN)

- `tests/integration/test_ldap_mail_auth.py`:
  - `test_imap_plain_auth_via_ldap_directory` — IMAP `AUTHENTICATE PLAIN
    testuser@example.org/password123` → `a2 OK ... Authentication successful`.
  - `test_mailboxes_folders_available_after_ldap_login` — SOGo
    `/mailboxes/0/folders` returns folders (not `S000310`).
- All three demo users (`testuser`, `testadmin`, `testuser2`) authenticate via LDAP.
- Full integration suite: **53 passed, 51 skipped, 0 failed** (no regression).

## Fallback note (only if a genuinely enterprise-gated feature is ever needed)

The original fork plan — clone `stalwartlabs/stalwart` @ `v0.16.19` into
`tobias-weiss-ai-xr/stalwart` (branch `ldap-community`), remove any
`#[cfg(feature = "enterprise")]` on the directory config spawn path, `cargo build
--release -p stalwart`, image `stalwart:0.16.19-ldap`, point
`docker-compose.yaml` `sogo6-stalwart.image` at it — is **not required** for LDAP
directory auth and is **superseded** by the config fix above.

## Rollback

Revert `sogo6/stalwart/config.toml` + `config.test.toml` to the pre-fix LDAP block
(remove `bind-authentication`, the placeholder, and `[authentication]`); the store
volume is otherwise unchanged. No custom image to remove.
