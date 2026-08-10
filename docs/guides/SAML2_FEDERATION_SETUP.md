# SAML2 Federation Setup Guide

This guide covers configuring SOGo6 as a SAML2 Service Provider (SP) for
federation with external Identity Providers (IdPs) such as Shibboleth IdPs
in research and education federations (e.g., DFN-AAI, InCommon, eduGAIN).

## Overview

SOGo6 supports two operational modes for SAML2:

1. **Simple mode** — Single IdP configured via `SOGO_D_SAML2_URL`
2. **Federation mode** — Multiple IdPs via metadata URL, federation metadata,
   or admin-managed provider database

## Prerequisites

### 1. Install xmlsec1

The `xmlsec1` binary is required for XML signature verification and is
installed in the Docker image via the Dockerfile.

For manual installation:
```bash
# Debian/Ubuntu
apt-get install xmlsec1 libxml2 libxmlsec1-dev

# Alpine
apk add xmlsec xmlsec-dev libxml2 libxml2-dev
```

### 2. Generate SP Keypair

Generate an X.509 certificate and private key for the SP:

```bash
openssl req -x509 -newkey rsa:2048 \
  -keyout sp-key.pem \
  -out sp-cert.pem \
  -days 3650 \
  -nodes \
  -subj "/CN=sogo-sp"
```

Mount these files into the SOGo6 container:

```yaml
# docker-compose.yaml
services:
  sogo6-server:
    volumes:
      - ./saml/sp-cert.pem:/etc/sogo/saml/sp-cert.pem:ro
      - ./saml/sp-key.pem:/etc/sogo/saml/sp-key.pem:ro
```

### 3. Install pysaml2

`pysaml2` is included in `pyproject.toml` and installed automatically.

## Configuration

### Global Settings (`.env`)

```bash
# SP keypair paths
SOGO_SAML2_SP_CERT_FILE=/etc/sogo/saml/sp-cert.pem
SOGO_SAML2_SP_KEY_FILE=/etc/sogo/saml/sp-key.pem

# Metadata cache TTL (seconds, default 21600 = 6 hours)
SOGO_SAML2_METADATA_CACHE_TTL=21600

# Federation metadata signing certificate (optional, for verifying federation metadata)
SOGO_SAML2_FEDERATION_METADATA_CERT=

# Clock skew tolerance (seconds, default 60)
SOGO_SAML2_CLOCK_SKEW=60
```

### Domain Settings (per-domain)

```bash
# Enable SAML2 for this domain
SOGO_D_AUTH_TYPE=saml2

# Simple mode: single IdP SSO URL
SOGO_D_SAML2_URL=https://idp.example.org/idp/profile/SAML2/Redirect/SSO

# Federation mode: IdP metadata URL (auto-fetches SSO URL, certificate, etc.)
SOGO_D_SAML2_IDP_METADATA_URL=https://idp.example.org/idp/shibboleth/metadata

# Federation mode: IdP entity ID (for validation)
SOGO_D_SAML2_IDP_ENTITY_ID=https://idp.example.org/idp/shibboleth

# Federation mode: federation aggregate metadata URL
SOGO_D_SAML2_FEDERATION_METADATA_URL=https://www.aai.dfn.de/metadata/dfn-aai-basic-metadata.xml

# Discovery service URL (optional, for external WAYF)
SOGO_D_SAML2_DISCOVERY_SERVICE_URL=

# Attribute mapping (SAML attribute name → field name)
SOGO_D_SAML2_ATTRIBUTE_MAP={"email":"mail","display_name":"displayName","eppn":"eppn","affiliation":"eduPersonAffiliation","scoped_affiliation":"eduPersonScopedAffiliation"}

# Require encrypted assertions
SOGO_D_SAML2_WANT_ENCRYPTED_ASSERTIONS=false

# Sign AuthnRequests
SOGO_D_SAML2_AUTHN_REQUESTS_SIGNED=true

# SP entity ID (defaults to ACS URL with /metadata/)
SOGO_D_SAML2_SP_ENTITY_ID=https://sogo.example.org/saml2/metadata

# Provider ID (for admin-managed providers)
SOGO_D_SAML2_PROVIDER_ID=
```

## Attribute Mapping

SOGo6 maps SAML attributes to user fields using `SOGO_D_SAML2_ATTRIBUTE_MAP`.
The default mapping supports both OID URNs and friendly names:

| SAML Attribute | OID | Mapped Field |
|---|---|---|
| `mail` | `urn:oid:0.9.2342.19200300.100.1.3` | `email` |
| `displayName` | `urn:oid:2.16.840.1.113730.3.1.241` | `display_name` |
| `givenName` | `urn:oid:2.5.4.42` | `given_name` |
| `sn` | `urn:oid:2.5.4.4` | `surname` |
| `eppn` (eduPersonPrincipalName) | `urn:oid:1.3.6.1.4.1.5923.1.1.1.6` | `eppn` |
| `eduPersonAffiliation` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.1` | `affiliation` |
| `eduPersonScopedAffiliation` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.9` | `scoped_affiliation` |
| `eduPersonUniqueId` | `urn:oid:1.3.6.1.4.1.5923.1.1.1.13` | `unique_id` |

## Admin Provider Management

SAML2 IdP providers can be managed via the admin API:

```bash
# List all providers
curl -X GET http://localhost:5001/api/admin/v1/auth/saml2/providers

# Create a provider
curl -X POST http://localhost:5001/api/admin/v1/auth/saml2/providers \
  -H "Content-Type: application/json" \
  -d '{
    "id": "uni-example",
    "name": "Example University",
    "entity_id": "https://idp.uni-example.org/idp/shibboleth",
    "sso_url": "https://idp.uni-example.org/idp/profile/SAML2/Redirect/SSO",
    "metadata_url": "https://idp.uni-example.org/idp/shibboleth/metadata",
    "is_active": true
  }'

# Refresh metadata from the provider's metadata URL
curl -X POST http://localhost:5001/api/admin/v1/auth/saml2/providers/uni-example/refresh
```

## Discovery Service (WAYF)

When `SOGO_D_SAML2_FEDERATION_METADATA_URL` is configured, the discovery
service at `/api/user/v1/auth/saml2/discovery` returns a list of available
IdPs. The UI provides a searchable WAYF page at `/auth/saml2/discovery`.

For large federations, an external WAYF can be configured via
`SOGO_D_SAML2_DISCOVERY_SERVICE_URL`, which redirects users to an external
discovery service.

## Security Features

- **XML Signature Verification** — All SAML responses are verified using
  `xmlsec1` via pysaml2
- **Replay Protection** — `InResponseTo` values are stored in Redis with a
  5-minute TTL and consumed on first use
- **Conditions Validation** — `NotBefore` / `NotOnOrAfter` are validated
  with configurable clock skew (`SOGO_SAML2_CLOCK_SKEW`)
- **Audience Restriction** — The SP entity ID must be in the audience
- **Encrypted Assertions** — Decrypted using the SP private key
- **AuthnRequest Signing** — When an SP keypair is configured,
  AuthnRequests are signed
- **Metadata Caching** — IdP and federation metadata is cached in Redis
  with stale-fallback on fetch failure

## DFN-AAI Federation Integration

For German universities using the DFN-AAI federation:

1. Register your SP at [DFN-AAI](https://www.aai.dfn.de/)
2. Configure the federation metadata URL:
   ```
   SOGO_D_SAML2_FEDERATION_METADATA_URL=https://www.aai.dfn.de/metadata/dfn-aai-basic-metadata.xml
   ```
3. Set your SP entity ID to match the registered value
4. Configure attribute mapping for eduPerson attributes
5. Test with the DFN-AAI test IdP before going live
