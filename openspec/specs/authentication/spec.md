## ADDED Requirements

### Requirement: SAML2 SP metadata endpoint

The system SHALL serve SP metadata at `GET /api/user/v1/auth/saml2/metadata` returning a valid SAML 2.0 metadata XML document. The metadata SHALL include the SP's `entityID`, `AssertionConsumerService` URL (HTTP-POST binding), `NameIDFormat`, `AuthnRequestsSigned` flag (true if SP keypair configured), and `WantAssertionsSigned` flag (true by default). The `entityID` SHALL be a stable URL derived from the server's public base URL, not derived from the ACS URL.

#### Scenario: Admin registers SP at IdP

- **WHEN** the IdP administrator fetches `GET /api/user/v1/auth/saml2/metadata`
- **THEN** the system returns `Content-Type: application/xml` with a valid `<md:EntityDescriptor>` containing the SP's entityID, ACS URL, and signing certificate (if configured)
- **AND** the metadata is importable into Shibboleth IdP, SimpleSAMLphp, or Keycloak without modification

#### Scenario: SP metadata without keypair

- **WHEN** no SP keypair is configured (`SOGO_SAML2_SP_KEY_FILE` / `SOGO_SAML2_SP_CERT_FILE` not set)
- **THEN** the metadata sets `AuthnRequestsSigned="false"` and omits the `<ds:KeyInfo>` / `<ds:X509Data>` elements
- **AND** `WantAssertionsSigned` remains `true` (SP still requires signed assertions from IdP)

#### Scenario: SP metadata with keypair

- **WHEN** an SP keypair is configured
- **THEN** the metadata includes `<ds:KeyInfo>` with the SP's X.509 certificate in `<ds:X509Certificate>`
- **AND** `AuthnRequestsSigned="true"` and `WantAssertionsSigned="true"` are set

### Requirement: SAML2 start endpoint

The system SHALL provide `GET /api/user/v1/auth/saml2/start` that initiates SP-initiated SSO by generating a signed AuthnRequest and returning a redirect URL to the IdP's SSO endpoint. The endpoint SHALL accept an optional `provider` query parameter to select a specific IdP (for multi-IdP configurations) and an optional `relay_state` parameter preserved through the flow.

#### Scenario: Start SAML2 flow with single IdP

- **WHEN** a client sends `GET /api/user/v1/auth/saml2/start?domain=example.com`
- **AND** the domain has `SOGO_D_AUTH_TYPE=saml2` with a single IdP configured
- **THEN** the system generates an AuthnRequest with a unique ID, `IssueInstant`, `Destination` (IdP SSO URL), `AssertionConsumerServiceURL` (SP ACS URL), and `Issuer` (SP entityID)
- **AND** if an SP keypair is configured, the AuthnRequest is signed
- **AND** the system returns `{ "redirect_url": "https://idp.example.org/SAML2/SSO?SAMLRequest=...&RelayState=..." }`

#### Scenario: Start SAML2 flow with federation discovery

- **WHEN** a client sends `GET /api/user/v1/auth/saml2/start?domain=example.com`
- **AND** the domain has federation metadata configured but no specific IdP selected
- **THEN** the system returns `{ "discovery_required": true, "discovery_url": "/api/user/v1/auth/saml2/discovery?domain=example.com" }`
- **AND** the client redirects the user to the discovery service for IdP selection

### Requirement: SAML2 signature verification

The system SHALL verify the XML signature on every SAML Response before trusting any assertion. If the response is signed at the response level, the system SHALL verify the response signature. If the response is unsigned but the assertion is signed, the system SHALL verify the assertion signature. If neither is signed and `WantAssertionsSigned` is true (default), the system SHALL reject the response.

#### Scenario: Valid signed response

- **WHEN** the IdP posts a SAML Response with a valid XML signature
- **AND** the signature is verified against the IdP's signing certificate (from metadata or manual config)
- **THEN** the system processes the assertion and extracts the user identity

#### Scenario: Forged unsigned response

- **WHEN** an attacker posts a crafted SAML Response without a signature
- **AND** `WantAssertionsSigned` is true (default)
- **THEN** the system rejects the response with `ERROR_SAML_SIGNATURE_INVALID`
- **AND** no user session is created
- **AND** the event is logged at WARNING level

#### Scenario: Signature with wrong certificate

- **WHEN** the SAML Response is signed with a certificate that does not match the IdP's configured signing certificate
- **THEN** the system rejects the response with `ERROR_SAML_SIGNATURE_INVALID`

### Requirement: SAML2 replay protection

The system SHALL prevent replay attacks by tracking `InResponseTo` values. When sending an AuthnRequest, the system SHALL store the request ID in Redis with a TTL (default 300 seconds). When processing a SAML Response, the system SHALL verify that the `InResponseTo` attribute matches a stored request ID and consume it (delete from Redis). Responses with unknown, missing, or expired `InResponseTo` values SHALL be rejected.

#### Scenario: Valid InResponseTo

- **WHEN** the system sends an AuthnRequest with ID `abc123`
- **AND** stores `abc123` in Redis with 300s TTL
- **AND** the IdP responds with `<samlp:Response InResponseTo="abc123">`
- **THEN** the system verifies `abc123` exists in Redis, consumes it, and processes the response

#### Scenario: Replay attack with reused InResponseTo

- **WHEN** an attacker replays a previously valid SAML Response with `InResponseTo="abc123"`
- **AND** `abc123` was already consumed (deleted from Redis)
- **THEN** the system rejects the response with `ERROR_SAML_REPLAY_DETECTED`

#### Scenario: Expired InResponseTo

- **WHEN** the IdP responds with `InResponseTo="abc123"` after the 300s TTL has expired
- **THEN** the system rejects the response with `ERROR_SAML_REQUEST_EXPIRED`

### Requirement: SAML2 conditions validation

The system SHALL validate SAML Response `<Conditions>` elements: `NotBefore` and `NotOnOrAfter`. The system SHALL reject responses where the current time is outside the validity window, with a configurable clock skew tolerance (default 60 seconds). The system SHALL validate `<AudienceRestriction>` and reject responses where the SP's entityID is not listed in `<Audience>`.

#### Scenario: Valid conditions

- **WHEN** the SAML Response contains `<Conditions NotBefore="2025-01-01T10:00:00Z" NotOnOrAfter="2025-01-01T10:05:00Z">`
- **AND** the current time is within the window (plus clock skew)
- **AND** `<AudienceRestriction>` contains the SP's entityID
- **THEN** the system processes the response

#### Scenario: Expired response

- **WHEN** the current time is after `NotOnOrAfter` (plus clock skew)
- **THEN** the system rejects with `ERROR_SAML_CONDITIONS_EXPIRED`

#### Scenario: Wrong audience

- **WHEN** `<AudienceRestriction>` does not contain the SP's entityID
- **THEN** the system rejects with `ERROR_SAML_AUDIENCE_MISMATCH`

### Requirement: SAML2 encrypted assertion support

The system SHALL decrypt encrypted assertions (`<saml:EncryptedAssertion>`) using the SP's private key when configured. If an assertion is encrypted and no SP private key is available, the system SHALL reject the response with `ERROR_SAML_ENCRYPTED_ASSERTION_NO_KEY`.

#### Scenario: Encrypted assertion with SP key

- **WHEN** the IdP encrypts the assertion to the SP's public key
- **AND** the SP private key is configured (`SOGO_SAML2_SP_KEY_FILE`)
- **THEN** the system decrypts the assertion using XML-Enc (AES-CBC + RSA-OAEP) and processes it

#### Scenario: Encrypted assertion without SP key

- **WHEN** the IdP encrypts the assertion
- **AND** no SP private key is configured
- **THEN** the system rejects with `ERROR_SAML_ENCRYPTED_ASSERTION_NO_KEY`

### Requirement: SAML2 attribute mapping

The system SHALL support configurable attribute mapping from SAML attribute names (OID URNs or friendly names) to SOGo user fields via `SOGO_D_SAML2_ATTRIBUTE_MAP` (JSON). The system SHALL extract `email`, `display_name`, and `username` from the mapped attributes. If `username` is mapped (e.g., to `eduPersonPrincipalName`), it SHALL be used for user lookup. If no mapping is configured, the system SHALL use defaults: `email` from `mail`/`email`/`urn:oid:0.9.2342.19200300.100.1.3`, `display_name` from `displayName`/`cn`/`urn:oid:2.5.4.3`.

#### Scenario: Federation attribute mapping

- **WHEN** `SOGO_D_SAML2_ATTRIBUTE_MAP={"email":"urn:oid:0.9.2342.19200300.100.1.3","username":"urn:oid:1.3.6.1.4.1.5923.1.1.1.6","display_name":"urn:oid:2.5.4.3"}`
- **AND** the IdP releases attributes with those OID URNs
- **THEN** the system maps the attributes to `email`, `username`, and `display_name` respectively
- **AND** uses `username` (eduPersonPrincipalName) for user lookup

#### Scenario: Default mapping without config

- **WHEN** no `SOGO_D_SAML2_ATTRIBUTE_MAP` is configured
- **AND** the SAML Response contains a `mail` attribute
- **THEN** the system extracts email from `mail` and falls back to NameID if no email attribute is present

### Requirement: SAML2 IdP entity ID validation

The system SHALL validate that the SAML Response `<Issuer>` matches the expected IdP entity ID. The expected entity ID is determined from: (1) the `Saml2Provider` database record if configured, (2) the IdP metadata if `SOGO_D_SAML2_IDP_METADATA_URL` is set, or (3) `SOGO_D_SAML2_IDP_ENTITY_ID` if manually configured. Responses with mismatched issuers SHALL be rejected with `ERROR_SAML_ISSUER_MISMATCH`.

#### Scenario: Valid issuer

- **WHEN** the response `<Issuer>` matches the expected IdP entity ID
- **THEN** the system processes the response

#### Scenario: Mismatched issuer

- **WHEN** the response `<Issuer>` is `https://evil-idp.example.org`
- **AND** the expected entity ID is `https://idp.example.org`
- **THEN** the system rejects with `ERROR_SAML_ISSUER_MISMATCH`

### Requirement: SAML2 callback endpoint rename

The system SHALL accept SAML Responses at both `POST /api/user/v1/auth/callback/<domain>` (existing, backward compatible) and `POST /api/user/v1/auth/saml2/acs` (new, spec-compliant). Both endpoints SHALL process the response identically through `InterfaceAuthSSO._handle_saml_callback()`.

#### Scenario: Existing callback URL

- **WHEN** the IdP posts a SAML Response to `POST /api/user/v1/auth/callback/example.com`
- **THEN** the system processes it through the SAML2 callback handler (backward compatible)

#### Scenario: New ACS URL

- **WHEN** the IdP posts a SAML Response to `POST /api/user/v1/auth/saml2/acs`
- **THEN** the system processes it through the same SAML2 callback handler
