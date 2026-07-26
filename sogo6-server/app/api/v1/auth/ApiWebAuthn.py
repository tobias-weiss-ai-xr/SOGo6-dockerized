from __future__ import annotations

from typing import TYPE_CHECKING

from flask import g, request
from flask_smorest import Blueprint
from marshmallow import fields, Schema

from app.interface.auth.InterfaceWebAuthn import InterfaceWebAuthn
from app.utils import errors as err
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import RequestException

if TYPE_CHECKING:
    from flask.typing import ResponseReturnValue

from .schema import webAuthn as sch


blp = Blueprint(
    "WebAuthn",
    __name__,
    url_prefix="/auth/webauthn",
    description="WebAuthn / Passkey registration and authentication for passwordless login",
)


def _get_interface() -> InterfaceWebAuthn:
    if not hasattr(g, "_webauthn_inter"):
        g._webauthn_inter = InterfaceWebAuthn(g.process_settings)
    return g._webauthn_inter


def _get_rp_id() -> str:
    """Derive the Relying Party ID from the request host."""
    host = request.host.split(":")[0]
    return host


def _get_origin() -> str:
    """Derive the origin from the request."""
    return f"{request.scheme}://{request.host}"


# ── Registration ──────────────────────────────────────────────────────────────


@blp.route("/register/begin")
class WebAuthnRegisterBegin:
    @blp.response(200, sch.WebAuthnRegisterBeginResponseSchema)
    def post(self) -> ResponseReturnValue:
        """Start WebAuthn credential registration.

        Returns PublicKeyCredentialCreationOptions for the browser's
        ``navigator.credentials.create()`` call.
        """
        try:
            inter = _get_interface()
            result = inter.registration_begin(
                user=g.user,
                rp_id=_get_rp_id(),
                origin=_get_origin(),
            )
            return create_api_base_response(result)
        except RequestException as exc:
            return create_api_base_response(error=exc.error)


class _WebAuthnRegisterCompleteSchema(Schema):
    """Request body for completing a registration."""
    credential = fields.Field(required=True)
    device_name = fields.String(load_default="")


@blp.route("/register/complete")
class WebAuthnRegisterComplete:
    @blp.arguments(_WebAuthnRegisterCompleteSchema, error_status_code=400)
    @blp.response(200, sch.WebAuthnRegisterCompleteResponseSchema)
    def post(self, data: dict) -> ResponseReturnValue:
        """Complete WebAuthn credential registration.

        Verify the browser's attestation response and store the credential.
        """
        try:
            inter = _get_interface()
            result = inter.registration_complete(
                user=g.user,
                credential=data["credential"],
                device_name=data.get("device_name", ""),
            )
            return create_api_base_response(result)
        except RequestException as exc:
            return create_api_base_response(error=exc.error)


# ── Authentication (login) ────────────────────────────────────────────────────


@blp.route("/login/begin")
class WebAuthnLoginBegin:
    @blp.response(200, sch.WebAuthnLoginBeginResponseSchema)
    def post(self) -> ResponseReturnValue:
        """Start WebAuthn authentication.

        Returns PublicKeyCredentialRequestOptions for the browser's
        ``navigator.credentials.get()`` call. If the user is not yet
        authenticated (login flow), the user_uid is extracted from the
        credential list; otherwise the authenticated user's credentials
        are used.
        """
        try:
            inter = _get_interface()
            user_uid = None
            if hasattr(g, "user") and not getattr(g.user, "anonymous", True):
                user_uid = g.user.uid
            result = inter.authentication_begin(
                rp_id=_get_rp_id(),
                user_uid=user_uid,
                origin=_get_origin(),
            )
            return create_api_base_response(result)
        except RequestException as exc:
            return create_api_base_response(error=exc.error)


class _WebAuthnLoginCompleteSchema(Schema):
    """Request body for completing authentication."""
    credential = fields.Field(required=True)


@blp.route("/login/complete")
class WebAuthnLoginComplete:
    @blp.arguments(_WebAuthnLoginCompleteSchema, error_status_code=400)
    @blp.response(200)
    def post(self, data: dict) -> ResponseReturnValue:
        """Complete WebAuthn authentication.

        Verify the browser's assertion response. Returns the user UID
        which the caller (login flow) uses to generate the session JWT.
        """
        try:
            inter = _get_interface()
            result = inter.authentication_complete(
                credential=data["credential"],
            )
            return create_api_base_response(result)
        except RequestException as exc:
            return create_api_base_response(error=exc.error)


# ── Credential management (authenticated) ──────────────────────────────────────


@blp.route("/credentials")
class WebAuthnCredentials:
    @blp.response(200, sch.WebAuthnCredentialsListResponseSchema)
    def get(self) -> ResponseReturnValue:
        """List all WebAuthn credentials for the authenticated user."""
        try:
            inter = _get_interface()
            creds = inter.get_credentials(g.user.uid)
            return create_api_base_response({"credentials": creds})
        except RequestException as exc:
            return create_api_base_response(error=exc.error)


class _WebAuthnDeleteSchema(Schema):
    """Request body for deleting a credential."""
    credential_id = fields.String(required=True)


@blp.route("/credentials/delete")
class WebAuthnCredentialDelete:
    @blp.arguments(_WebAuthnDeleteSchema, error_status_code=400)
    @blp.response(200)
    def post(self, data: dict) -> ResponseReturnValue:
        """Delete a WebAuthn credential for the authenticated user."""
        try:
            inter = _get_interface()
            inter.delete_credential(data["credential_id"], g.user.uid)
            return create_api_base_response({})
        except RequestException as exc:
            return create_api_base_response(error=exc.error)
