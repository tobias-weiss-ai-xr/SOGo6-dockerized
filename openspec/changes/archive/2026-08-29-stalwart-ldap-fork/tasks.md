# Tasks — Enable LDAP directory auth in Stalwart (community build, config-only)

> **Pivot (2026-08-29):** the original plan forked Stalwart to un-gate the LDAP
> directory. Empirical verification proved the LDAP directory backend is **not**
> enterprise-gated in the community build — it just needed correct configuration.
> The goal is achieved without a fork. Tasks are re-scoped accordingly.

## T1 — Write the acceptance test (RED → GREEN) ✅ DONE

- [x] `tests/integration/test_ldap_mail_auth.py`:
  - IMAP `AUTHENTICATE PLAIN testuser@example.org/password123` against `sogo6-stalwart:143`
    asserts **success** (was RED via `xfail(strict=True)`; now a plain passing test).
  - SOGo `/mailboxes/0/folders` returns folders (not `S000310`).
- [x] Confirmed RED first (community image, no LDAP directory configured), then GREEN
      once the directory was activated.

## T2 — Fork Stalwart + un-gate LDAP config ❌ CANCELLED (not needed)

- [x] Investigated: `crates/directory/src/lib.rs` unconditionally builds `LdapDirectory`;
      `x:Directory/set`/`x:Directory/get` work in community. **No fork/gate exists.**
- [x] Fork `tobias-weiss-ai-xr/stalwart` @ `v0.16.19`, branch `ldap-community` — **not
      required** (verified LDAP not gated); revived only if a genuinely enterprise-gated
      feature is needed later.

## T3 — Build the fork image ❌ CANCELLED (not needed)

- [x] `cargo build --release -p stalwart` + image `stalwart:0.16.19-ldap` — **not
      required** (verified); the stock `stalwartlabs/stalwart:0.16.19` image works as-is.

## T4 — Configure the LDAP directory (wire into stack) ✅ DONE

- [x] `sogo6/stalwart/config.toml` + `config.test.toml`:
  - `filter = "(|(uid={username})(mail={username}))"` (login-scoped placeholder).
  - `bind-authentication = true`.
  - `[authentication] directoryId = "ldap"`.
- [x] Live store configured via management API (persisted in `sogo6_sogo6-stalwart-data`):
  `x:Directory/set` (`@type:Ldap`, store-schema keys) + `x:Authentication/set directoryId`.
- [x] `x:Directory/query` confirms the directory is loaded; IMAP auth succeeds.

## T5 — GREEN + no regression ✅ DONE

- [x] TDD acceptance test passes (`test_ldap_mail_auth.py`: 2 passed).
- [x] Full integration suite: **53 passed, 51 skipped, 0 failed** (no regression).
      (The 8 `test_stack.py` admin/redis failures seen in an ad-hoc run were a missing
      `SOGO_ADMIN_PASSWORD` env var, not a regression — they pass with the vault value.)

## T6 — Document ✅ DONE

- [x] `tests/GAP-ANALYSIS.md` §3 corrected: the "community build gates the directory
      subsystem" conclusion was **wrong**; LDAP auth works via config. §3.3 (principal
      blob surgery) marked obsolete.
- [x] `tests/integration/test_ldap_mail_auth.py` docstring documents the finding.
- [x] Memory `mem_mtdnpjym_mte4vpuu` corrected (LDAP not gated; config recipe recorded).
- [x] Archive this OpenSpec change (it is now a config-change record).
