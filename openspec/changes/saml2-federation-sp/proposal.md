## Why

The current SAML2 SP implementation (`ModuleSAML2.py`) is a minimal prototype that parses SAML Responses **without verifying XML signatures** — a critical security vulnerability that allows forged authentication. It also lacks IdP metadata fetching, SP metadata serving, replay protection, encrypted assertion support, and federation metadata aggregation. This makes it impossible to safely integrate with external Shibboleth IdPs in federations (e.g., DFN-AAI, InCommon, eduGAIN), which require trust-establishment via metadata exchange, signature verification, and attribute mapping for federation-specific attributes (eduPersonPrincipalName, eduPersonAffiliation, etc.).

The existing `authentication.spec.md` claims SAML2 is "✅ Complete" with signature validation, multiple IdPs, SP metadata endpoint, and admin provider management — but none of these are implemented in code. This change brings the implementation in line with the spec and extends it for federation-grade SSO.

## What Changes

### Security (Critical Fixes)
- **Add XML signature verification** on SAML Responses and Assertions using the IdP's signing certificate (from metadata or manual config)
- **Add replay protection** via `InResponseTo` tracking (stored in Redis with TTL) and `NotBefore`/`NotOnOrAfter` condition validation
- **Add audience restriction checking** — verify SP entityID is in the `<AudienceRestriction>` element
- **Add encrypted assertion decryption** using the SP's private key (XML-Enc AES-CBC + RSA-OAEP)
- **Add AuthnRequest signing** using the SP's private key (when configured)

### Federation Support (New)
- **Add IdP metadata fetching and parsing** — fetch IdP metadata XML from a URL, extract SSO URL + signing certificates + entity ID, cache in Redis with TTL-based refresh
- **Add federation metadata aggregation** — fetch and parse federation aggregate metadata (e.g., DFN-AAI basic metadata) containing multiple IdPs, with Redis-cached lookup by entity ID
- **Add discovery service (WAYF)** — "Where Are You From?" endpoint for multi-IdP federations, serving an IdP selection page or redirecting to an external WAYF/DS service
- **Add configurable attribute mapping** — map SAML attributes (OID URNs like `urn:oid:1.3.6.1.4.1.5923.1.1.1.6` for eduPersonPrincipalName) to SOGo user fields (email, display name, username)

### SP Metadata & Key Management (New)
- **Add SP metadata endpoint** — `GET /api/user/v1/auth/saml2/metadata` serving the SP's metadata XML for IdP trust registration
- **Add SP keypair management** — generate or load SP X.509 certificate + private key (PEM), stored on the filesystem, used for AuthnRequest signing and assertion decryption
- **Add SAML2 start endpoint** — `GET /api/user/v1/auth/saml2/start` initiating the SP-initiated SSO flow (builds AuthnRequest, redirects to IdP)

### Provider Management (New)
- **Add SAML2 provider database model** — `Saml2Provider` table storing IdP trust relationships (entity ID, SSO URL, certificates, metadata URL, attribute map, active status)
- **Add admin SAML2 provider API** — CRUD endpoints at `/api/admin/v1/auth/saml2/providers` for managing IdP trust relationships

### Configuration (New)
- **Add domain settings**: `SOGO_D_SAML2_IDP_METADATA_URL`, `SOGO_D_SAML2_SP_ENTITY_ID`, `SOGO_D_SAML2_ATTRIBUTE_MAP`, `SOGO_D_SAML2_FEDERATION_METADATA_URL`, `SOGO_D_SAML2_DISCOVERY_SERVICE_URL`, `SOGO_D_SAML2_WANT_ENCRYPTED_ASSERTIONS`, `SOGO_D_SAML2_AUTHN_REQUESTS_SIGNED`
- **Add global settings**: `SOGO_SAML2_SP_KEY_FILE`, `SOGO_SAML2_SP_CERT_FILE`, `SOGO_SAML2_METADATA_CACHE_TTL`
- **Add `pysaml2` and `xmlsec1`** as dependencies for production-grade SAML2 processing

### Spec Correction
- **Update `authentication.spec.md`** — change SAML2 status from "✅ Complete" to reflect actual implementation state, then document the target state after this change

## Capabilities

### New Capabilities
- `saml2-federation`: Federation-grade SAML2 SP — IdP/federation metadata fetching, caching, and refresh; discovery service (WAYF) for multi-IdP federations; SAML2 provider management (admin CRUD); SP keypair management; configurable attribute mapping for federation attributes (eduPerson OIDs)

### Modified Capabilities
- `authentication`: SAML2 section requirements change — add signature verification, replay protection, audience checking, encrypted assertion support, SP metadata endpoint, SAML2 start endpoint; correct the spec from "✅ Complete" to accurately reflect pre/post-change state

## Impact

### Code
- `sogo6-server/app/module/auth/ModuleSAML2.py` — rewrite internals to use `pysaml2`, keep public interface for `InterfaceAuthSSO`
- `sogo6-server/app/interface/auth/InterfaceAuthSSO.py` — update `_build_saml()` to pass IdP entity ID, certificates, SP keypair; add metadata fetch + discovery dispatch
- `sogo6-server/app/api/v1/auth/AuthUserApi.py` — add `/saml2/start`, `/saml2/metadata`, `/saml2/discovery` endpoints
- `sogo6-server/app/api/v1/admin/` — new admin SAML2 provider management API
- `sogo6-server/app/model/auth/Saml2Provider.py` — new database model
- `sogo6-server/app/config/settings/DomainSettings.py` — add SAML2 domain settings
- `sogo6-server/app/config/settings/SystemSettings.py` — add SAML2 global settings
- `sogo6-ui/src/lib/api/endpoints/auth.ts` — add SAML2 metadata, discovery, start endpoints to RTK Query
- `sogo6-ui/src/` — add WAYF/discovery page component for IdP selection

### Dependencies
- `pysaml2` (Python package) — SAML2 library
- `xmlsec1` (system package) — XML signature/encryption support (required by pysaml2)

### Infrastructure
- `Dockerfile` — install `xmlsec1` system package
- `docker-compose.yaml` — add volume for SP keypair (`/etc/sogo/saml/`)
- `.env.example` — document new SAML2 environment variables

### Security
- Fixes critical signature verification gap (current code trusts unverified SAML Responses)
- Adds replay protection (prevents response replay attacks)
- Adds audience restriction (premits cross-service response replay)
- Adds encrypted assertion support (protects attribute confidentiality)
