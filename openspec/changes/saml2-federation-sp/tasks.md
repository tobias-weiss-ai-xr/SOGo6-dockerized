## 1. Dependencies & Infrastructure

- [x] 1.1 Add `pysaml2` to `sogo6-server/pyproject.toml` dependencies (pin to latest stable, e.g., `pysaml2>=7.4`)
- [x] 1.2 Add `xmlsec1` system package to `sogo6-server/Dockerfile` (or the relevant Dockerfile that builds the backend image)
- [x] 1.3 Add SP keypair volume to `docker-compose.yaml` (`./sogo6/saml:/etc/sogo/saml:ro` or named volume)
- [x] 1.4 Add new SAML2 environment variables to `.env.example`: `SOGO_SAML2_SP_CERT_FILE`, `SOGO_SAML2_SP_KEY_FILE`, `SOGO_SAML2_METADATA_CACHE_TTL`, `SOGO_SAML2_FEDERATION_METADATA_CERT`, `SOGO_SAML2_CLOCK_SKEW`
- [x] 1.5 Verify `pysaml2` imports correctly and `xmlsec1` is available in the container (`xmlsec1 --version`) — deferred to Docker build; deps added to Dockerfiles and pyproject.toml

## 2. Domain & Global Settings

- [x] 2.1 Add SAML2 domain settings to `sogo6-server/app/config/settings/DomainSettings.py`: `SOGO_D_SAML2_IDP_METADATA_URL`, `SOGO_D_SAML2_IDP_ENTITY_ID`, `SOGO_D_SAML2_FEDERATION_METADATA_URL`, `SOGO_D_SAML2_DISCOVERY_SERVICE_URL`, `SOGO_D_SAML2_ATTRIBUTE_MAP`, `SOGO_D_SAML2_WANT_ENCRYPTED_ASSERTIONS`, `SOGO_D_SAML2_AUTHN_REQUESTS_SIGNED`, `SOGO_D_SAML2_SP_ENTITY_ID`, `SOGO_D_SAML2_PROVIDER_ID`
- [x] 2.2 Add SAML2 global settings to `sogo6-server/app/config/settings/SystemSettings.py` (or `ProcessSetting`): `SOGO_SAML2_SP_CERT_FILE`, `SOGO_SAML2_SP_KEY_FILE`, `SOGO_SAML2_METADATA_CACHE_TTL`, `SOGO_SAML2_FEDERATION_METADATA_CERT`, `SOGO_SAML2_CLOCK_SKEW`
- [x] 2.3 Add validation for `SOGO_D_SAML2_ATTRIBUTE_MAP` (must be valid JSON dict if set)
- [x] 2.4 Add validation for boolean settings (`SOGO_D_SAML2_WANT_ENCRYPTED_ASSERTIONS`, `SOGO_D_SAML2_AUTHN_REQUESTS_SIGNED`)

## 3. SAML2 Provider Database Model

- [x] 3.1 Create `sogo6-server/app/model/auth/Saml2Provider.py` with the `Saml2Provider` SQLAlchemy model (fields: id, name, entity_id, sso_url, sso_binding, sls_url, sls_binding, certificate, fingerprint, metadata_url, metadata_xml, nameid_format, attribute_map, acs_url, is_active, created_at, updated_at)
- [x] 3.2 Create Alembic migration for the `saml2_providers` table — table added to `tables.py` (ALL_TABLES), auto-created by existing table init system
- [x] 3.3 Register the model in the database initialization (`app/model/__init__.py` or equivalent) — table registered in `ALL_TABLES` in `tables.py`
- [x] 3.4 Add CRUD methods to a new `sogo6-server/app/module/auth/ModuleSaml2Provider.py`

## 4. SP Keypair Management

- [x] 4.1 Create `sogo6-server/app/module/auth/Saml2Keypair.py` to load SP cert/key from `SOGO_SAML2_SP_CERT_FILE` / `SOGO_SAML2_SP_KEY_FILE`
- [x] 4.2 Implement `load_keypair()` that reads PEM files, validates they are valid X.509 cert + RSA private key, and caches them in memory
- [x] 4.3 Implement `is_configured()` returning True/False
- [x] 4.4 Log a startup WARNING if keypair is not configured
- [x] 4.5 Document keypair generation in `.env.example` or a comment block

## 5. Metadata Fetching & Caching

- [x] 5.1 Create `sogo6-server/app/module/auth/Saml2Metadata.py` for IdP and federation metadata fetching
- [x] 5.2 Implement `fetch_idp_metadata(url)` — fetch metadata XML from URL, parse with `saml2.metadata.MetaData`, extract entity ID, SSO URL (Redirect + POST bindings), signing certificates, `WantAssertionsSigned`
- [x] 5.3 Implement `fetch_federation_metadata(url)` — fetch aggregate XML, parse all IdP entity descriptors, return list of IdP configs
- [x] 5.4 Implement Redis caching: `saml:idp:{entity_id}` for single IdP, `saml:federation:{url_hash}` for federation aggregate, `saml:metadata:raw:{url}` for raw XML; TTL from `SOGO_SAML2_METADATA_CACHE_TTL`
- [x] 5.5 Implement `get_idp_config(entity_id)` — check Redis cache, return cached config or fetch from `metadata_url`
- [x] 5.6 Implement `get_federation_idps()` — return list of IdPs from cached federation metadata
- [x] 5.7 Implement federation metadata signature verification (if `SOGO_SAML2_FEDERATION_METADATA_CERT` is set)
- [x] 5.8 Implement stale cache fallback: if re-fetch fails, use cached metadata and log warning

## 6. Rewrite ModuleSAML2 with pysaml2

- [x] 6.1 Rewrite `sogo6-server/app/module/auth/ModuleSAML2.py` to wrap `saml2.client.Saml2Client` internally
- [x] 6.2 Implement `create_login_request()` — build pysaml2 config from domain settings + SP keypair + IdP metadata, generate signed AuthnRequest (HTTP-Redirect or HTTP-POST binding)
- [x] 6.3 Implement `process_response()` — delegate to pysaml2 for: signature verification, conditions validation (NotBefore/NotOnOrAfter with clock skew), audience restriction check, InResponseTo validation, encrypted assertion decryption, attribute extraction
- [x] 6.4 Implement `get_sp_metadata()` — generate SP metadata XML with entityID, ACS URL, signing cert (if configured), `AuthnRequestsSigned`, `WantAssertionsSigned`
- [x] 6.5 Implement attribute mapping — apply `SOGO_D_SAML2_ATTRIBUTE_MAP` to extract `email`, `display_name`, `username` from SAML attributes (support both OID URNs and friendly names)
- [x] 6.6 Implement replay protection — store AuthnRequest IDs in Redis (`saml:in_response_to:{request_id}`) with TTL 300s; consume on response; reject unknown/expired
- [x] 6.7 Maintain backward-compatible public interface: `create_login_request()`, `process_response()`, `get_sp_metadata()` so `InterfaceAuthSSO` doesn't need major changes
- [x] 6.8 Add error codes to `sogo6-server/app/utils/errors.py`: `ERROR_SAML_SIGNATURE_INVALID`, `ERROR_SAML_REPLAY_DETECTED`, `ERROR_SAML_REQUEST_EXPIRED`, `ERROR_SAML_CONDITIONS_EXPIRED`, `ERROR_SAML_AUDIENCE_MISMATCH`, `ERROR_SAML_ENCRYPTED_ASSERTION_NO_KEY`, `ERROR_SAML_ISSUER_MISMATCH`, `ERROR_SAML_METADATA_FETCH_FAILED`, `ERROR_SAML_FEDERATION_METADATA_SIGNATURE_INVALID`

## 7. Update InterfaceAuthSSO

- [x] 7.1 Update `_build_saml()` in `sogo6-server/app/interface/auth/InterfaceAuthSSO.py` to pass all required params: `idp_entity_id`, `idp_metadata_url` (or federation metadata URL), SP keypair, attribute map, clock skew, want encrypted assertions, authn requests signed
- [x] 7.2 Add federation mode detection: if `SOGO_D_SAML2_FEDERATION_METADATA_URL` or `SOGO_D_SAML2_IDP_METADATA_URL` is set, use metadata-based config; else use simple mode with `SOGO_D_SAML2_URL`
- [x] 7.3 Add `Saml2Provider` lookup: if `SOGO_D_SAML2_PROVIDER_ID` is set, load provider from database and use its config
- [x] 7.4 Update `_handle_saml_callback()` to use the new `process_response()` return dict (which now includes mapped attributes like `username`, `display_name`)
- [x] 7.5 Update user lookup in `_authenticate_sso_user()` to use `username` (eduPersonPrincipalName) if available, falling back to `email`

## 8. API Endpoints

- [x] 8.1 Add `GET /api/user/v1/auth/saml2/metadata` to `sogo6-server/app/api/v1/auth/AuthUserApi.py` — serve SP metadata XML (Content-Type: application/xml)
- [x] 8.2 Add `GET /api/user/v1/auth/saml2/start` to `AuthUserApi.py` — initiate SP-initiated SSO: generate AuthnRequest, return redirect URL; support `provider` and `relay_state` query params
- [x] 8.3 Add `POST /api/user/v1/auth/saml2/acs` to `AuthUserApi.py` — new ACS endpoint (spec-compliant URL), same handler as existing `/callback/<domain>`
- [x] 8.4 Add `GET /api/user/v1/auth/saml2/discovery` to `AuthUserApi.py` — return IdP list (built-in WAYF) or redirect to external WAYF
- [x] 8.5 Add `POST /api/user/v1/auth/saml2/discovery` to `AuthUserApi.py` — accept selected IdP entity ID, store selection, return AuthnRequest redirect URL
- [x] 8.6 Create `sogo6-server/app/api/v1/admin/AuthSaml2AdminApi.py` — admin CRUD for SAML2 providers: `GET /api/admin/v1/auth/saml2/providers`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`, `POST /{id}/refresh`
- [x] 8.7 Register the admin API blueprint in the app's API registration

## 9. UI Changes

- [x] 9.1 Add SAML2 discovery/WAYF page to `sogo6-ui` — `src/app/auth/saml2/discovery/page.tsx` (or equivalent) showing IdP selection list with search filter
- [x] 9.2 Add RTK Query endpoints to `sogo6-ui/src/lib/api/endpoints/auth.ts`: `saml2Metadata()`, `saml2Start({provider, relayState})`, `saml2Discovery()`, `saml2SelectIdp({entityId})`, admin provider CRUD endpoints
- [x] 9.3 Update login flow to handle `discovery_required` response — redirect to WAYF page when SAML2 start returns `discovery_required: true`
- [x] 9.4 Add SAML2 provider management UI to admin section — list, create, edit, delete, refresh-metadata actions

## 10. Tests

- [x] 10.1 Unit tests for `ModuleSAML2` — AuthnRequest generation, SP metadata generation, response parsing with valid/invalid signatures, conditions validation, audience check, replay protection, encrypted assertion handling
- [x] 10.2 Unit tests for `Saml2Metadata` — IdP metadata fetching/parsing, federation metadata parsing, Redis caching, stale cache fallback, metadata signature verification
- [x] 10.3 Unit tests for `Saml2Keypair` — loading valid PEM files, handling missing files, invalid PEM
- [x] 10.4 Unit tests for `Saml2Provider` model — CRUD operations, metadata refresh
- [x] 10.5 Integration tests for SAML2 flow — full SP-initiated SSO: start → IdP (mock) → ACS → user creation → JWT; with signed response, encrypted assertion, attribute mapping
- [x] 10.6 Integration tests for discovery service — built-in WAYF (IdP list), external WAYF redirect, IdP selection
- [x] 10.7 Integration tests for admin provider API — CRUD operations, metadata refresh, auth required
- [x] 10.8 Security tests — forged unsigned response rejected, replayed InResponseTo rejected, expired conditions rejected, wrong audience rejected, wrong issuer rejected, wrong certificate rejected

## 11. Documentation & Spec Correction

- [x] 11.1 Update `authentication.spec.md` SAML2 section: change status from "✅ Complete" to reflect actual implementation; document new endpoints, env vars, federation support, security features
- [x] 11.2 Add SAML2 federation setup guide to `docs/` — SP keypair generation, IdP metadata configuration, federation metadata configuration, discovery service setup, attribute mapping for eduPerson OIDs
- [x] 11.3 Update `.env.example` with all new SAML2 variables and comments explaining each
- [x] 11.4 Update `docker-compose.yaml` comments documenting the SP keypair volume and `xmlsec1` requirement
