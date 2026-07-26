"""
API endpoints for MFA / TOTP multi-factor authentication.

Provides:
  - GET  /auth/mfa/setup    — generate TOTP secret and provisioning URI
  - POST /auth/mfa/enable   — verify first code and activate TOTP
  - POST /auth/mfa/disable  — deactivate TOTP (requires password re-auth)
"""

from __future__ import annotations

from typing import Any

from flask import g
from flask.views import MethodView
from flask.typing import ResponseReturnValue
from flask_smorest import Blueprint
from marshmallow import Schema, fields

from app.auth.User import User
from app.interface.auth.InterfaceMFA import InterfaceMFA
from app.utils import errors as err
from app.utils.api.ApiBaseResponse import create_api_base_response
from app.utils.exceptions import RequestException
from app.utils.logger.logger import logger_api

blp = Blueprint("MFA", __name__, url_prefix="/auth/mfa")


# ── Schemas ──────────────────────────────────────────────────────────────────


class SetupResponseSchema(Schema):
    """Response after a successful setup."""

    secret = fields.String(dump_default="")
    provisioning_uri = fields.String(dump_default="")
    qr_svg = fields.String(dump_default="")


class EnableRequestSchema(Schema):
    """Request body for enabling TOTP."""

    code = fields.String(required=True)


class DisableRequestSchema(Schema):
    """Request body for disabling TOTP."""

    password = fields.String(required=True)


# ── Before request: inject interface ─────────────────────────────────────────


@blp.before_request
def init_mfa_interface() -> None:
    """Initialise the MFA interface on every request to this blueprint."""
    from app.config.settings.ProcessSetting import process_config

    if "mfa_inter" not in g:
        inter = InterfaceMFA(process_config)
        g.mfa_inter = inter


# ── Endpoints ────────────────────────────────────────────────────────────────


@blp.route("/setup")
class ApiMFASetup(MethodView):
    """(Authenticated) Generate a new TOTP secret and return provisioning info."""

    @blp.response(200, SetupResponseSchema)
    def get(self) -> dict[str, Any]:
        user: User = g.user
        inter: InterfaceMFA = g.mfa_inter
        return inter.setup(user)


@blp.route("/enable")
class ApiMFAEnable(MethodView):
    """(Authenticated) Verify the first TOTP code and enable MFA."""

    @blp.arguments(EnableRequestSchema, error_status_code=400)
    @blp.response(200)
    def post(self, new_data: dict[str, Any]) -> ResponseReturnValue:
        user: User = g.user
        inter: InterfaceMFA = g.mfa_inter
        try:
            inter.enable(user, new_data["code"])
        except RequestException as exc:
            return create_api_base_response(None, exc.error)
        return create_api_base_response(None)


@blp.route("/disable")
class ApiMFADisable(MethodView):
    """(Authenticated + password) Disable TOTP for the current user.

    Requires the user's current password for security.
    """

    @blp.arguments(DisableRequestSchema, error_status_code=400)
    @blp.response(200)
    def post(self, new_data: dict[str, Any]) -> ResponseReturnValue:
        user: User = g.user
        inter: InterfaceMFA = g.mfa_inter

        uid = user.uid
        password = new_data["password"]

        # Re-authenticate the user via the standard login API
        from app.interface.auth.InterfaceAuthUser import InterfaceAuthUser
        from app.config.settings.ProcessSetting import process_config
        from app.config.init_config import init_get_system_and_default_domain_settings

        system_settings, default_domain = init_get_system_and_default_domain_settings()
        auth_inter = InterfaceAuthUser(process_config, system_settings, default_domain)
        try:
            success, reauth_user, _ = auth_inter._check_login(uid, password)
            if not success:
                return create_api_base_response(None, err.ERROR_LOGIN_FAILED)
        except RequestException as exc:
            return create_api_base_response(None, exc.error)

        try:
            inter.disable(user)
        except RequestException as exc:
            return create_api_base_response(None, exc.error)

        return create_api_base_response(None)
