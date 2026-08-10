## Context

The current SAML2 SP implementation (`sogo6-server/app/module/auth/ModuleSAML2.py`, ~274 lines) is a minimal prototype:

- **What works**: AuthnRequest generation (HTTP-Redirect), SAML Response XML parsing (defusedxml), NameID/attribute extraction, email extraction, SP metadata XML generation (`get_sp_metadata()`)
- **What's missing (critical)**: No XML signature verification on responses, no IdP entity ID validation (not passed in `_build_saml()`), no replay protection (InResponseTo), no conditions/audience checking, no encrypted assertion support, no IdP metadata fetching, no SP metadata endpoint (method exists but no route), no SP keypair management, no federation metadata support, no discovery service, no attribute mapping configuration
- **Existing config**: Only `SOGO_D_SAML2_URL` (IdP SSO URL) in `DomainSettings.py`. The spec documents `SOGO_SAML2_IDP_METADATA_URL`, `SOGO_SAML2_SP_ENTITY_ID`, etc. but these are not implemented
- **Existing dispatch**: `InterfaceAuthSSO._handle_saml_callback()` calls `saml.process_response()` which trusts the parsed XML blindly
- **Dependencies**: Only `defusedxml` and `cryptography` are available. No `pysaml2`, no `xmlsec1`

The use case is integrating SOGo as a SAML2 SP with external Shibboleth IdPs in federations (DFN-AAI, InCommon, eduGAIN). These federations publish aggregate metadata containing hundreds of IdPs, use federation-specific attribute OIDs (eduPersonPrincipalName, eduPersonAffiliation, eduPersonScopedAffiliation), and require proper metadata exchange and signature verification.

## Goals / Non-Goals

**Goals:**
- Make SAML2 SP production-safe by verifying XML signatures on all SAML Responses
- Support external IdP integration via metadata URL (fetch, parse, cache, refresh)
- Support federation metadata aggregates (multi-IdP lookup by entity ID)
- Provide a discovery service (WAYF) for federations with multiple IdPs
- Serve SP metadata for IdP trust registration
- Support encrypted assertions (XML-Enc)
- Support configurable attribute mapping for federation-specific OIDs
- Maintain backward compatibility with existing per-domain `SOGO_D_SAML2_URL` config (simple single-IdP mode)
- Add SAML2 provider management API for admins

**Non-Goals:**
- Not bundling a Shibboleth IdP container (that's a separate profile, like the existing `--profile keycloak`)
- Not implementing IdP-side functionality (SOGo is always the SP)
- Not implementing SAML2 Single Logout (SLO) in this change (future work)
- Not implementing IdP-initiated SSO (only SP-initiated)
- Not replacing the existing OIDC or CAS auth flows
- Not auto-provisioning users from federation attributes beyond email/name (group/role mapping is future work)

## Decisions

### D1: Use `pysaml2` instead of enhancing the custom module

**Choice**: Replace `ModuleSAML2` internals with `pysaml2` (Python SAML2 library).

**Rationale**:
- XML signature verification (XML-Sig) requires correct canonicalization (c14n), transform processing, and XPath filtering — getting this wrong is a security vulnerability. `pysaml2` delegates to `xmlsec1` (battle-tested C library).
- Encrypted assertions (XML-Enc) require AES-CBC + RSA-OAEP decryption — significant complexity to implement correctly.
- Federation metadata aggregates (DFN-AAI: ~500 IdPs, 2MB+ XML) need efficient parsing, caching, and entity lookup — `pysaml2` has `saml2.metadata.MetaData` and `saml2.entity` for this.
- Discovery service (WAYF) support is built into `pysaml2` via `saml2.discovery`.
- pysaml2 handles metadata refresh, certificate rotation, and multiple signing certificates.

**Alternative considered**: Enhance the custom module with `cryptography` library for XML-Sig. Rejected because XML-Sig verification has ~1000 edge cases (exclusive vs inclusive c14n, enveloped signatures, transform chaining) and implementing encrypted assertion support would require XML-Enc from scratch.

**Implementation**: `ModuleSAML2` keeps its public interface (`create_login_request()`, `process_response()`, `get_sp_metadata()`) but internally wraps `pysaml2.client.Saml2Client`. `InterfaceAuthSSO._build_saml()` constructs the pysaml2 config from domain settings.

### D2: SP keypair stored on filesystem, managed by admin

**Choice**: SP X.509 certificate and private key stored as PEM files on the filesystem (`/etc/sogo/saml/sp-cert.pem`, `/etc/sogo/saml/sp-key.pem`), mounted as a Docker volume.

**Rationale**:
- Keys should persist across container restarts (not in Redis)
- Standard practice for SAML SPs (Apache mod_shib, pysaml2, Spring Security all use file-based keys)
- Admin can generate keys with `openssl` or provide existing ones
- Docker volume makes key management transparent and backup-friendly

**Alternative considered**: Generate keys on first boot and store in database. Rejected because private keys should not live in the database, and auto-generation makes key rotation opaque.

**Fallback**: If no key files exist, SOGo can operate in "unsigned AuthnRequest" mode (IdP doesn't require signed requests), but encrypted assertions won't be possible. A startup warning is logged.

### D3: IdP metadata cached in Redis with TTL-based refresh

**Choice**: Fetch IdP/federation metadata on first access, parse with `pysaml2.metadata.MetaData`, store the parsed configuration in Redis with a 6-hour TTL. On cache miss or expiry, re-fetch.

**Rationale**:
- Federation metadata aggregates are large (2MB+) — fetching on every auth request is too slow
- Redis is already used by the stack (session store, cache)
- pysaml2's `MetaData` class supports loading from URL and from XML string
- TTL ensures certificate rotation in federation metadata is picked up
- Stale cache is better than auth failure (if IdP metadata URL is temporarily down, use cached version)

**Key schema**:
- `saml:idp:{entity_id}` → JSON: `{sso_url, signing_certs[], entity_id, want_signed, name_id_format}`
- `saml:federation:{url_hash}` → JSON: list of IdP entity IDs and their metadata
- `saml:metadata:raw:{url}` → raw XML (for pysaml2 re-parse on cache miss)
- TTL: 21600 seconds (6 hours), configurable via `SOGO_SAML2_METADATA_CACHE_TTL`

### D4: Discovery service — built-in WAYF + external redirect

**Choice**: Two modes, controlled by `SOGO_D_SAML2_DISCOVERY_SERVICE_URL`:
- **Not set + federation metadata configured**: Built-in WAYF page — SOGo UI renders an IdP selection page listing IdPs from the federation metadata
- **Set (external WAYF/DS URL)**: SOGo redirects to the external discovery service with `entityID` (SP's) and `return` URL parameters; the external DS redirects back with the selected IdP entity ID

**Rationale**:
- Small federations (single IdP) don't need discovery — skip directly to AuthnRequest
- Medium federations (a few IdPs) benefit from a simple built-in selector
- Large federations (DFN-AAI: 500+ IdPs) use external WAYF services (e.g., DFN-AAI WAYF) with search/filter
- Supporting both modes covers all deployment scenarios

### D5: Attribute mapping — configurable, with federation OID defaults

**Choice**: Domain setting `SOGO_D_SAML2_ATTRIBUTE_MAP` is a JSON dict mapping SOGo field names to SAML attribute names (OID URNs or friendly names). Defaults provided for common federation attributes.

**Default mapping**:
```json
{
  "email": "urn:oid:0.9.2342.19200300.100.1.3",
  "display_name": "urn:oid:2.5.4.3",
  "username": "urn:oid:1.3.6.1.4.1.5923.1.1.1.6",
  "affiliation": "urn:oid:1.3.6.1.4.1.5923.1.1.1.1",
  "scoped_affiliation": "urn:oid:1.3.6.1.4.1.5923.1.1.1.9"
}
```

**Rationale**:
- Different federations/IdPs use different attribute names (friendly names vs OID URNs)
- eduPersonPrincipalName (`eppn`) is the standard federation identity attribute — often more stable than email
- Admin must be able to configure which attribute maps to which SOGo field
- The `username` field maps to `eppn` by default — this is the federated identity, used for user lookup instead of (or in addition to) email

### D6: SAML2 provider model — database-backed admin management

**Choice**: New `Saml2Provider` database table for managing IdP trust relationships via admin API, complementing the per-domain settings.

**Schema**:
```
saml2_providers
  id              VARCHAR(255) PRIMARY KEY  -- entity ID or slug
  name            VARCHAR(255)              -- display name
  entity_id       VARCHAR(500)              -- IdP entity ID
  sso_url         VARCHAR(500)              -- IdP SSO URL
  sso_binding     VARCHAR(50)               -- HTTP-Redirect or HTTP-POST
  sls_url         VARCHAR(500)              -- Single Logout URL (future)
  sls_binding     VARCHAR(50)
  certificate     TEXT                      -- IdP signing cert (PEM)
  fingerprint     VARCHAR(100)              -- Cert fingerprint (SHA-256)
  metadata_url    VARCHAR(500)              -- IdP metadata URL (for auto-refresh)
  metadata_xml    TEXT                      -- Cached metadata XML
  nameid_format   VARCHAR(100)              -- Requested NameID format
  attribute_map   JSON                      -- SAML attr → SOGo field mapping
  acs_url         VARCHAR(500)              -- ACS URL override (optional)
  is_active       BOOLEAN                   -- Enabled/disabled
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
```

**Rationale**:
- Per-domain settings (`SOGO_D_SAML2_*`) are good for simple single-IdP deployments
- Database model allows admins to manage multiple IdPs via UI/API without editing env vars
- `metadata_url` + `metadata_xml` enable auto-refresh of IdP config
- The provider model and domain settings coexist: domain settings can reference a provider by ID, or specify inline config

### D7: Backward compatibility — simple mode vs federation mode

**Choice**: Two operational modes, auto-detected from configuration:
- **Simple mode** (existing): Only `SOGO_D_SAML2_URL` set → single IdP, no metadata fetching, no discovery. Works exactly as before (but now with signature verification if cert is configured).
- **Federation mode** (new): `SOGO_D_SAML2_IDP_METADATA_URL` or `SOGO_D_SAML2_FEDERATION_METADATA_URL` set → metadata fetching, cert extraction, discovery service, attribute mapping.

**Rationale**:
- Existing deployments with just `SOGO_D_SAML2_URL` continue working
- New federation features are opt-in via new config keys
- No migration needed for existing single-IdP setups

## Risks / Trade-offs

- **[pysaml2 + xmlsec1 dependency]** → Adds a system dependency (`xmlsec1`) to the Docker image and a Python dependency (`pysaml2`). Mitigation: Add to Dockerfile, pin version in `pyproject.toml`. `xmlsec1` is widely available in Debian/Ubuntu base images.

- **[Metadata cache staleness]** → If IdP rotates its signing certificate and the cache hasn't refreshed, signature verification fails. Mitigation: 6-hour TTL is standard; admin can force-refresh via API; on verification failure, retry with fresh metadata before failing.

- **[Federation metadata size]** → DFN-AAI aggregate is ~2MB XML with 500+ IdPs. Parsing on every cache miss is slow. Mitigation: Cache parsed metadata in Redis (not just raw XML); only parse on cache miss (every 6 hours); pysaml2's `MetaData` class is designed for this.

- **[XML canonicalization edge cases]** → Even with pysaml2, some IdPs produce non-standard XML that fails c14n. Mitigation: Log detailed errors; provide a "skip signature verification" debug mode (disabled by default, logged as WARNING) for troubleshooting only.

- **[Discovery service UX]** → Built-in WAYF page for 500+ IdPs is a poor UX. Mitigation: Recommend external WAYF for large federations; built-in WAYF includes search/filter; limit built-in WAYF to federations with <50 IdPs.

- **[SP keypair not configured]** → If admin doesn't provide SP cert/key, encrypted assertions and signed AuthnRequests are disabled. Mitigation: Log startup warning; SP metadata correctly reflects `AuthnRequestsSigned="false"` and `WantAssertionsSigned="false"`; admin guide documents key generation.

- **[Breaking change to ModuleSAML2 constructor]** → `_build_saml()` currently passes 3 params; new version passes more. Mitigation: The `InterfaceAuthSSO` is the only caller; update both in the same change.

## Migration Plan

1. **Pre-deployment**: Admin generates SP keypair: `openssl req -x509 -newkey rsa:2048 -keyout sp-key.pem -out sp-cert.pem -days 3650 -nodes -subj "/CN=sogo-sp"`
2. **Deploy**: New Docker image with `pysaml2` + `xmlsec1`; mount keypair volume; set new env vars
3. **Configure IdP trust**: Register SOGo SP metadata (`/api/user/v1/auth/saml2/metadata`) at the IdP
4. **Configure SOGo**: Set `SOGO_D_SAML2_IDP_METADATA_URL` (or keep `SOGO_D_SAML2_URL` for simple mode)
5. **Test**: Verify AuthnRequest → IdP → ACS → signature verification → user login
6. **Rollback**: Revert to previous image; old `SOGO_D_SAML2_URL` config still works (simple mode without signature verification, as before)

No database migration needed for existing deployments (new `Saml2Provider` table is additive). New table created via existing Alembic migration system.

## Open Questions

- **Q1**: Should the built-in WAYF page live in `sogo6-ui` (React) or `sogo6-server` (Flask template)? → Lean toward `sogo6-ui` for consistency, with a `/auth/saml2/discovery` API endpoint returning the IdP list as JSON.
- **Q2**: Should we support SAML2 Single Logout (SLO) in this change or defer? → Defer. SLO adds complexity (front-channel vs back-channel, session tracking). This change focuses on SSO + security + federation.
- **Q3**: Should `Saml2Provider` replace domain settings entirely, or coexist? → Coexist. Domain settings for simple single-IdP; `Saml2Provider` for multi-IdP/federation. Domain setting `SOGO_D_SAML2_PROVIDER_ID` can reference a provider.
- **Q4**: How to handle IdP metadata signature verification? Federation metadata is itself signed (DFN-AAI signs its aggregate). → pysaml2 supports metadata signature verification via `metadata.trusted_certs`. Configure federation metadata signing cert separately.
