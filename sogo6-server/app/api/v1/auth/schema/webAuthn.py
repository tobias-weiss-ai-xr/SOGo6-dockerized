from marshmallow import fields, Schema


class WebAuthnRegisterBeginResponseSchema(Schema):
    """PublicKeyCredentialCreationOptions sent to the client to start registration."""
    publicKey = fields.Field(required=True, dump_default=None)

    @classmethod
    def example(cls) -> dict:
        return {
            "publicKey": {
                "rp": {"name": "SOGo 6", "id": "localhost"},
                "user": {
                    "name": "user@example.org",
                    "id": "dXNlckBleGFtcGxlLm9yZw==",
                    "displayName": "John Doe",
                },
                "challenge": "aGVsbG8...",
                "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
                "timeout": 60000,
            }
        }


class WebAuthnRegisterCompleteSchema(Schema):
    """Credential creation response from the browser (attestation)."""
    id = fields.String(required=True)
    rawId = fields.String(required=True)
    type = fields.String(required=True, dump_default="public-key")
    response = fields.Field(required=True)


class WebAuthnRegisterCompleteResponseSchema(Schema):
    """Result of a successful WebAuthn registration."""
    credential_id = fields.String(dump_default=None)
    device_name = fields.String(dump_default=None)

    @classmethod
    def example(cls) -> dict:
        return {
            "credential_id": "AqC0pA...",
            "device_name": "My YubiKey",
        }


class WebAuthnLoginBeginResponseSchema(Schema):
    """PublicKeyCredentialRequestOptions sent to the client to start authentication."""
    publicKey = fields.Field(required=True, dump_default=None)

    @classmethod
    def example(cls) -> dict:
        return {
            "publicKey": {
                "challenge": "aGVsbG8...",
                "rpId": "localhost",
                "allowCredentials": [],
                "timeout": 60000,
                "userVerification": "preferred",
            }
        }


class WebAuthnLoginCompleteSchema(Schema):
    """Credential assertion response from the browser."""
    id = fields.String(required=True)
    rawId = fields.String(required=True)
    type = fields.String(required=True, dump_default="public-key")
    response = fields.Field(required=True)
    clientExtensionResults = fields.Field(load_default=None, dump_default=None)


class WebAuthnCredentialResponseSchema(Schema):
    """A single stored WebAuthn credential."""
    id = fields.Integer(dump_default=None)
    credential_id = fields.String(dump_default=None)
    device_name = fields.String(dump_default=None)
    transports = fields.Field(dump_default=None)
    enabled = fields.Boolean(dump_default=None)
    created_at = fields.String(dump_default=None)
    last_used_at = fields.String(dump_default=None, allow_none=True)


class WebAuthnCredentialsListResponseSchema(Schema):
    """List of stored WebAuthn credentials."""
    credentials = fields.List(fields.Nested(WebAuthnCredentialResponseSchema), dump_default=[])
