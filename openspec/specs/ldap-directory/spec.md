# ldap-directory Specification

## Purpose
Stalwart SHALL load and authenticate users from an LDAP directory (the local OpenLDAP
tree `dc=example,dc=org`) in the stock community build — no enterprise license and no
custom fork required. This enables SOGo IMAP/SMTP mail authentication for the demo
users (`testuser@example.org`, `testadmin@example.org`, `testuser2@example.org`) and
flips `MAIL_BACKEND_AVAILABLE=True`.

## Requirements

### Requirement: Stalwart fork accepts LDAP directory configuration without an enterprise license

Our Stalwart fork SHALL parse and load a directory configured with `type = "ldap"`
from `config.toml` without requiring any enterprise license token or `enterprise`
feature at runtime. The LDAP directory backend SHALL be compiled into the fork binary
(unconditionally, not behind a feature gate). `[directory."<id>"]` blocks with
`type = "ldap"` SHALL be accepted and registered as an auth source.

#### Scenario: LDAP directory config is loaded on startup

- **WHEN** the fork starts with `[directory."ldap"]` containing `type = "ldap"` and valid bind/base settings
- **THEN** the directory is registered without an enterprise-license error
- **AND** `x:Directory/query` (or the equivalent management call) reports the LDAP directory as present

#### Scenario: Community image refuses LDAP config (negative contract for baseline)

- **WHEN** the upstream `stalwartlabs/stalwart:0.16.19` community image is started with the same `type = "ldap"` config
- **THEN** the LDAP directory is NOT loaded (no auth source) — confirming the gate our fork removes

### Requirement: Users authenticate against the LDAP directory

The fork SHALL authenticate mail users (IMAP, POP3, SMTP/submission, manage-sieve)
against the configured LDAP directory by performing an LDAP bind with the supplied
credentials. A successful LDAP bind SHALL grant access; a failed bind SHALL deny it.

#### Scenario: IMAP PLAIN auth succeeds for an LDAP user

- **WHEN** a client issues `IMAP AUTHENTICATE PLAIN` for `testuser@example.org` with the correct password
- **AND** `testuser@example.org` exists in the `sogo6-ldap` directory (`dc=example,dc=org`)
- **THEN** authentication succeeds and the IMAP session is established

#### Scenario: Wrong password is rejected

- **WHEN** a client authenticates with a correct username but an incorrect password
- **THEN** authentication fails with `AUTHENTICATIONFAILED` and no session is created

#### Scenario: Unknown user is rejected

- **WHEN** a client authenticates with a username not present in the LDAP directory
- **THEN** authentication fails and no principal is exposed

### Requirement: Principals are auto-provisioned from LDAP entries

For each successfully authenticated LDAP user, the fork SHALL auto-provision (or reuse)
a Stalwart principal carrying the user's email(s) and name, so that mailboxes, folders,
and messages are available without manual `d`/`g` store surgery.

#### Scenario: Mailbox listing works after LDAP login

- **WHEN** `testuser@example.org` authenticates via LDAP
- **THEN** `GET /api/user/v1/mailboxes/0/folders` returns the user's folders (e.g. INBOX) instead of `S000310 "IMAP Unauthorized"`
- **AND** `MAIL_BACKEND_AVAILABLE` in the test environment becomes `True`

### Requirement: LDAP directory configuration honors bind, base, filter, and attribute mapping

The fork SHALL honor the LDAP directory config: `address`/`port`/`protocol`, `bind-dn`/
`bind-password`, `base-dn`, `user-filter`, and the attribute mappings
(`attributes.user`, `attributes.email`, `attributes.name`). Credentials SHALL be verified
by binding as the resolved user DN.

#### Scenario: Custom base DN and user filter are applied

- **WHEN** the LDAP directory is configured with `base-dn = "dc=example,dc=org"` and `user-filter = "(objectClass=inetOrgPerson)"`
- **THEN** only entries under that base matching the filter are considered valid users
- **AND** authentication resolves the user via that search before binding

#### Scenario: Bind DN / password from injected secret

- **WHEN** the directory `bind-password` is provided via the vault/env (`LDAP_ADMIN_PASSWORD`)
- **THEN** the fork connects to `sogo6-ldap` using that bind credential to perform searches

### Requirement: Deployment wires the fork into the SOGo6 stack

The SOGo6 `docker-compose.yaml` SHALL reference the fork image for `sogo6-stalwart`, and
the running `sogo6-stalwart` SHALL be configured with the LDAP directory pointing at the
existing `sogo6-ldap` service. The change SHALL be reproducible (image tag + config in
repo) and reversible.

#### Scenario: Stack deploys with fork image

- **WHEN** `docker compose up -d sogo6-stalwart` runs with the fork image
- **THEN** `sogo6-stalwart` becomes healthy and serves IMAP/SMTP
- **AND** log inspection shows the LDAP directory loaded

#### Scenario: Rollback to community image

- **WHEN** `docker-compose.yaml` `image:` is reverted to `stalwartlabs/stalwart:0.16.19` and the service recreated
- **THEN** the stack returns to its prior (mail-auth-disabled) state without data loss
- **AND** the `sogo6_sogo6-stalwart-data` volume is preserved

### Requirement: No regression to existing functionality

Enabling the LDAP directory SHALL NOT break any currently-passing behavior: Stalwart
still serves IMAP/SMTP/POP3/submission, the SOGo LDAP consumer still works, and the full
test suite (`run-all-tests.sh`) stays green (368 passed).

#### Scenario: Full suite stays green

- **WHEN** the fork is deployed and the LDAP directory is active
- **THEN** `run-all-tests.sh` reports the same 368 passing tests with no new failures
- **AND** the mail surface transitions from skipped to passing (not failing)

#### Scenario: Existing listeners unaffected

- **WHEN** the fork runs
- **THEN** the previously-enabled plain `imap` listener on `:143` and other listeners
  continue to serve as before
