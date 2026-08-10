## ADDED Requirements

### Requirement: SAML2 IdP metadata fetching

The system SHALL fetch IdP metadata from a configured URL (`SOGO_D_SAML2_IDP_METADATA_URL`) and parse it to extract the IdP's entity ID, SSO URL (HTTP-Redirect and HTTP-POST bindings), signing certificates, and `WantAssertionsSigned` flag. The parsed metadata SHALL be cached in Redis with a configurable TTL (`SOGO_SAML2_METADATA_CACHE_TTL`, default 21600 seconds / 6 hours). On cache miss or TTL expiry, the system SHALL re-fetch the metadata. If the fetch fails, the system SHALL use the cached metadata (if available) and log a warning.

#### Scenario: Fetch IdP metadata on first access

- **WHEN** `SOGO_D_SAML2_IDP_METADATA_URL=https://idp.example.org/idp/shibboleth` is configured
- **AND** no cached metadata exists in Redis
- **THEN** the system fetches the metadata XML from the URL
- **AND** parses it to extract entity ID, SSO URL, signing certificates
- **AND** stores the parsed metadata in Redis at key `saml:idp:{entity_id}` with TTL 21600
- **AND** uses the metadata for AuthnRequest generation and signature verification

#### Scenario: Use cached metadata

- **WHEN** metadata is cached in Redis and the TTL has not expired
- **THEN** the system uses the cached metadata without fetching

#### Scenario: Metadata refresh on TTL expiry

- **WHEN** the cached metadata TTL has expired
- **THEN** the system re-fetches the metadata from the URL
- **AND** updates the Redis cache with the fresh metadata
- **AND** if the fetch fails, uses the stale cached metadata and logs a warning

#### Scenario: Metadata fetch failure with no cache

- **WHEN** the metadata URL is unreachable
- **AND** no cached metadata exists
- **THEN** the system returns `ERROR_SAML_METADATA_FETCH_FAILED`
- **AND** logs the error with the URL and exception details

### Requirement: SAML2 federation metadata aggregation

The system SHALL support federation metadata aggregation via `SOGO_D_SAML2_FEDERATION_METADATA_URL`. When configured, the system fetches the aggregate metadata XML (containing multiple `<md:EntityDescriptor>` entries), parses all IdP entries, and caches them in Redis. The system SHALL support looking up an IdP by entity ID within the federation. The federation metadata SHALL be re-fetched on TTL expiry (same `SOGO_SAML2_METADATA_CACHE_TTL`).

#### Scenario: Federation metadata with multiple IdPs

- **WHEN** `SOGO_D_SAML2_FEDERATION_METADATA_URL=https://example.org/metadata/aggregate.xml` is configured
- **AND** the aggregate contains 50 IdP entity descriptors
- **THEN** the system parses all 50 IdPs and stores them in Redis at key `saml:federation:{url_hash}`
- **AND** each IdP is individually retrievable by entity ID

#### Scenario: Lookup IdP by entity ID in federation

- **WHEN** a discovery service selects IdP `https://idp.uni-example.de/idp/shibboleth`
- **THEN** the system looks up that entity ID in the cached federation metadata
- **AND** retrieves the SSO URL and signing certificates for that IdP
- **AND** uses them to generate the AuthnRequest and verify the response

### Requirement: SAML2 federation metadata signature verification

The system SHALL verify the signature on federation metadata XML if a federation metadata signing certificate is configured (`SOGO_SAML2_FEDERATION_METADATA_CERT`). If the metadata signature is invalid or the signing certificate does not match, the system SHALL reject the metadata with `ERROR_SAML_FEDERATION_METADATA_SIGNATURE_INVALID`.

#### Scenario: Valid federation metadata signature

- **WHEN** the federation metadata is signed
- **AND** `SOGO_SAML2_FEDERATION_METADATA_CERT` is configured with the federation's signing certificate
- **THEN** the system verifies the metadata signature before parsing
- **AND** proceeds with parsing if the signature is valid

#### Scenario: Invalid federation metadata signature

- **WHEN** the federation metadata signature does not match the configured certificate
- **THEN** the system rejects the metadata with `ERROR_SAML_FEDERATION_METADATA_SIGNATURE_INVALID`
- **AND** does not parse or cache the metadata

### Requirement: SAML2 discovery service (WAYF)

The system SHALL provide a discovery service at `GET /api/user/v1/auth/saml2/discovery` for multi-IdP federations. When `SOGO_D_SAML2_DISCOVERY_SERVICE_URL` is set, the system SHALL redirect to the external WAYF/DS service with `entityID` (SP's entity ID) and `return` URL parameters. When not set and federation metadata is configured, the system SHALL return a JSON list of available IdPs (entity ID, display name, SSO URL) for a built-in WAYF selection page.

#### Scenario: External discovery service

- **WHEN** `SOGO_D_SAML2_DISCOVERY_SERVICE_URL=https://wayf.example.org/WAYF` is configured
- **AND** the client sends `GET /api/user/v1/auth/saml2/discovery?domain=example.com`
- **THEN** the system redirects to `https://wayf.example.org/WAYF?entityID=<SP_entityID>&return=<return_url>`
- **AND** the external WAYF returns the selected IdP entity ID to the return URL

#### Scenario: Built-in discovery for small federation

- **WHEN** no external discovery service is configured
- **AND** federation metadata is configured with ≤50 IdPs
- **AND** the client sends `GET /api/user/v1/auth/saml2/discovery?domain=example.com`
- **THEN** the system returns `{ "idps": [{ "entity_id": "...", "name": "...", "logo_url": "..." }, ...] }`
- **AND** the UI renders an IdP selection page

#### Scenario: Discovery returns selected IdP

- **WHEN** the user selects an IdP from the discovery page
- **AND** the client sends `POST /api/user/v1/auth/saml2/discovery` with `{ "entity_id": "https://idp.example.org/idp/shibboleth" }`
- **THEN** the system stores the selection and generates an AuthnRequest for that IdP
- **AND** returns the redirect URL to the IdP

### Requirement: SAML2 SP keypair management

The system SHALL load the SP's X.509 certificate and private key from configurable file paths (`SOGO_SAML2_SP_CERT_FILE`, `SOGO_SAML2_SP_KEY_FILE`). If the files do not exist, the system SHALL operate in unsigned mode (no AuthnRequest signing, no encrypted assertion decryption) and log a startup warning. The keypair SHALL be used for: (1) signing AuthnRequests, (2) decrypting encrypted assertions, (3) including the certificate in SP metadata.

#### Scenario: Keypair configured

- **WHEN** `SOGO_SAML2_SP_CERT_FILE=/etc/sogo/saml/sp-cert.pem` and `SOGO_SAML2_SP_KEY_FILE=/etc/sogo/saml/sp-key.pem` point to valid PEM files
- **THEN** the system loads the keypair at startup
- **AND** signs AuthnRequests with the private key
- **AND** includes the certificate in SP metadata
- **AND** can decrypt encrypted assertions

#### Scenario: Keypair not configured

- **WHEN** the SP keypair files do not exist or are not configured
- **THEN** the system starts in unsigned mode
- **AND** logs a WARNING: "SAML2 SP keypair not configured — AuthnRequests will not be signed, encrypted assertions not supported"
- **AND** SP metadata sets `AuthnRequestsSigned="false"` and omits the certificate
- **AND** if an encrypted assertion is received, returns `ERROR_SAML_ENCRYPTED_ASSERTION_NO_KEY`

### Requirement: SAML2 provider management API

The system SHALL provide admin API endpoints for managing SAML2 IdP provider configurations at `/api/admin/v1/auth/saml2/providers`. The API SHALL support: list all providers (GET), get a single provider (GET `/{id}`), create a provider (POST), update a provider (PUT `/{id}`), delete a provider (DELETE `/{id}`), and force-refresh a provider's metadata (POST `/{id}/refresh`). All endpoints require admin authentication.

#### Scenario: Create SAML2 provider

- **WHEN** an admin sends `POST /api/admin/v1/auth/saml2/providers` with `{ "name": "University IdP", "entity_id": "https://idp.uni-example.de/idp/shibboleth", "metadata_url": "https://idp.uni-example.de/idp/shibboleth", "attribute_map": {"email": "urn:oid:0.9.2342.19200300.100.1.3"} }`
- **THEN** the system creates a `Saml2Provider` record in the database
- **AND** fetches and caches the IdP metadata from `metadata_url`
- **AND** returns `201 Created` with the provider record

#### Scenario: Force-refresh provider metadata

- **WHEN** an admin sends `POST /api/admin/v1/auth/saml2/providers/{id}/refresh`
- **THEN** the system re-fetches the IdP metadata from the provider's `metadata_url`
- **AND** updates the cached metadata in Redis
- **AND** updates the `certificate`, `sso_url`, and `fingerprint` fields from the fresh metadata
- **AND** returns `200 OK` with the updated provider record

#### Scenario: List providers

- **WHEN** an admin sends `GET /api/admin/v1/auth/saml2/providers`
- **THEN** the system returns a paginated list of all SAML2 providers with their entity ID, name, SSO URL, active status, and last metadata refresh time

### Requirement: SAML2 provider database model

The system SHALL store SAML2 provider configurations in a `saml2_providers` database table. The table SHALL include: `id` (primary key, entity ID or slug), `name` (display name), `entity_id` (IdP entity ID), `sso_url` (SSO endpoint), `sso_binding` (HTTP-Redirect or HTTP-POST), `sls_url` (SLO endpoint, nullable), `sls_binding` (nullable), `certificate` (IdP signing cert PEM, nullable), `fingerprint` (cert SHA-256 fingerprint, nullable), `metadata_url` (IdP metadata URL, nullable), `metadata_xml` (cached metadata XML, nullable), `nameid_format` (default: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`), `attribute_map` (JSON), `acs_url` (override, nullable), `is_active` (boolean, default true), `created_at`, `updated_at`.

#### Scenario: Provider record creation

- **WHEN** a new SAML2 provider is created via the admin API
- **THEN** a record is inserted into `saml2_providers` with all fields
- **AND** `created_at` and `updated_at` are set to the current timestamp
- **AND** `is_active` defaults to `true`

#### Scenario: Provider metadata auto-refresh

- **WHEN** a provider has a `metadata_url`
- **AND** the cached metadata TTL expires
- **THEN** the system re-fetches the metadata and updates `certificate`, `sso_url`, `fingerprint`, and `metadata_xml` fields
- **AND** updates `updated_at`

### Requirement: SAML2 domain settings for federation mode

The system SHALL support the following domain-level SAML2 settings in `DomainSettings`, enabling federation-grade SSO: `SOGO_D_SAML2_IDP_METADATA_URL` (IdP metadata URL for auto-configuration), `SOGO_D_SAML2_IDP_ENTITY_ID` (expected IdP entity ID for issuer validation), `SOGO_D_SAML2_FEDERATION_METADATA_URL` (federation aggregate metadata URL), `SOGO_D_SAML2_DISCOVERY_SERVICE_URL` (external WAYF/DS URL, nullable), `SOGO_D_SAML2_ATTRIBUTE_MAP` (JSON attribute mapping), `SOGO_D_SAML2_WANT_ENCRYPTED_ASSERTIONS` (boolean, default false), `SOGO_D_SAML2_AUTHN_REQUESTS_SIGNED` (boolean, default true if keypair configured), `SOGO_D_SAML2_SP_ENTITY_ID` (SP entity ID override), `SOGO_D_SAML2_PROVIDER_ID` (reference to a Saml2Provider record, nullable).

#### Scenario: Federation mode configuration

- **WHEN** a domain has `SOGO_D_AUTH_TYPE=saml2`, `SOGO_D_SAML2_FEDERATION_METADATA_URL=https://aai.example.org/metadata/aggregate.xml`, and `SOGO_D_SAML2_ATTRIBUTE_MAP={"email":"urn:oid:0.9.2342.19200300.100.1.3","username":"urn:oid:1.3.6.1.4.1.5923.1.1.1.6"}`
- **THEN** the system fetches and caches the federation metadata
- **AND** requires IdP selection via discovery service before AuthnRequest
- **AND** maps attributes using the configured mapping

#### Scenario: Simple mode backward compatibility

- **WHEN** a domain has only `SOGO_D_AUTH_TYPE=saml2` and `SOGO_D_SAML2_URL` (existing config)
- **AND** no federation or metadata URL is set
- **THEN** the system operates in simple mode (single IdP, no discovery)
- **AND** uses `SOGO_D_SAML2_URL` as the IdP SSO URL
- **AND** if `SOGO_D_SAML2_IDP_ENTITY_ID` is set, validates the issuer; otherwise skips issuer validation with a warning

### Requirement: SAML2 global settings

The system SHALL support the following global SAML2 settings: `SOGO_SAML2_SP_CERT_FILE` (path to SP X.509 cert PEM), `SOGO_SAML2_SP_KEY_FILE` (path to SP private key PEM), `SOGO_SAML2_METADATA_CACHE_TTL` (Redis cache TTL for metadata, default 21600), `SOGO_SAML2_FEDERATION_METADATA_CERT` (federation metadata signing cert PEM for verifying aggregate signatures, nullable), `SOGO_SAML2_CLOCK_SKEW` (clock skew tolerance in seconds for conditions validation, default 60).

#### Scenario: Global SP keypair configuration

- **WHEN** `SOGO_SAML2_SP_CERT_FILE=/etc/sogo/saml/sp-cert.pem` and `SOGO_SAML2_SP_KEY_FILE=/etc/sogo/saml/sp-key.pem` are set
- **THEN** the system loads the keypair at startup
- **AND** all domains use this keypair for AuthnRequest signing and assertion decryption

#### Scenario: Metadata cache TTL configuration

- **WHEN** `SOGO_SAML2_METADATA_CACHE_TTL=3600` is set
- **THEN** IdP and federation metadata cached in Redis expires after 1 hour
- **AND** the system re-fetches metadata after expiry

### Requirement: SAML2 pysaml2 dependency

The system SHALL use `pysaml2` (Python SAML2 library) for SAML2 protocol operations: AuthnRequest generation, response parsing, signature verification, encrypted assertion decryption, metadata parsing, and federation metadata handling. The system SHALL require `xmlsec1` (system package) as a dependency of `pysaml2` for XML signature and encryption operations. The `ModuleSAML2` class SHALL wrap `pysaml2.client.Saml2Client` internally while maintaining its existing public interface (`create_login_request()`, `process_response()`, `get_sp_metadata()`).

#### Scenario: pysaml2 handles signature verification

- **WHEN** a SAML Response is received
- **THEN** `ModuleSAML2.process_response()` delegates to pysaml2's response validation
- **AND** pysaml2 verifies the XML signature using `xmlsec1`
- **AND** pysaml2 checks conditions, audience, and InResponseTo
- **AND** if any check fails, pysaml2 raises an exception that ModuleSAML2 translates to `RequestException`

#### Scenario: pysaml2 handles metadata parsing

- **WHEN** IdP metadata is fetched from a URL
- **THEN** the system uses `saml2.metadata.MetaData` to parse the XML
- **AND** extracts SSO URL, signing certificates, and entity ID
- **AND** caches the parsed metadata in Redis
